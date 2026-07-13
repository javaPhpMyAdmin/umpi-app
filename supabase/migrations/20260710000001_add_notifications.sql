-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('review', 'subscription_expiring')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Partial index for fast unread count (only indexes unread rows)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id)
  WHERE is_read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Select: users see their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- Insert: only server-side functions insert (authenticated but system-level)
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- Update: users can update is_read on their own notifications
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_read IS NOT DISTINCT FROM true);

-- Delete: users can delete their own notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ==========================================
-- Trigger: review notification
-- ==========================================

-- Creates a notification for the listing owner when someone leaves a review
CREATE OR REPLACE FUNCTION fn_create_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_listing_id uuid;
  v_listing_title text;
  v_owner_id uuid;
  v_reviewer_name text;
BEGIN
  -- Get listing info from the conversation
  SELECT c.listing_id, l.title, l.user_id
  INTO v_listing_id, v_listing_title, v_owner_id
  FROM conversations c
  JOIN listings l ON l.id = c.listing_id
  WHERE c.id = NEW.conversation_id;

  -- Get reviewer name
  SELECT COALESCE(
    NULLIF(display_name, ''),
    NULLIF(full_name, ''),
    'Usuario'
  ) INTO v_reviewer_name
  FROM profiles
  WHERE id = NEW.reviewer_id;

  -- Don't notify yourself
  IF v_owner_id = NEW.reviewer_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_owner_id,
    'review',
    'Nueva calificación',
    v_reviewer_name || ' te calificó con ' || NEW.rating || ' estrellas',
    jsonb_build_object(
      'listing_id', v_listing_id,
      'listing_title', v_listing_title,
      'review_id', NEW.id,
      'rating', NEW.rating
    )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to reviews table
DROP TRIGGER IF EXISTS trg_create_review_notification ON reviews;
CREATE TRIGGER trg_create_review_notification
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION fn_create_review_notification();

-- ==========================================
-- Function: subscription expiry notification
-- ==========================================

-- Can be called by pg_cron or manual check
CREATE OR REPLACE FUNCTION fn_check_subscription_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Insert notification for subscriptions expiring in 3 days
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    s.user_id,
    'subscription_expiring',
    'Suscripción por vencer',
    'Tu suscripción ' || COALESCE(sp.name, '') || ' vence el ' ||
      TO_CHAR(s.expires_at::date, 'DD/MM/YYYY'),
    jsonb_build_object(
      'subscription_id', s.id,
      'expires_at', s.expires_at
    )
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.status = 'active'
    AND s.expires_at IS NOT NULL
    AND s.expires_at::date = (CURRENT_DATE + INTERVAL '3 days')::date
    -- Avoid duplicate notifications
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.user_id
        AND n.type = 'subscription_expiring'
        AND (n.data->>'subscription_id')::uuid = s.id
        AND n.created_at::date = CURRENT_DATE
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Create default notification for existing subscriptions that expire in 3 days
SELECT fn_check_subscription_expiry();
