/*
# Harden notifications RLS: only system triggers can insert

Changes:
1. `fn_create_review_notification()` → SECURITY DEFINER (trigger runs with
    system privileges, bypassing RLS)
2. `fn_check_subscription_expiry()` → SECURITY DEFINER (consistency)
3. INSERT policy on `notifications`: only `service_role` can insert
    (authenticated users can no longer create notifications directly)
*/

-- ==========================================
-- 1. Review trigger function → SECURITY DEFINER
-- ==========================================

CREATE OR REPLACE FUNCTION fn_create_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ==========================================
-- 2. Subscription expiry function → SECURITY DEFINER
-- ==========================================

CREATE OR REPLACE FUNCTION fn_check_subscription_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ==========================================
-- 3. Restrict INSERT policy to service_role only
-- ==========================================

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ==========================================
-- 4. Update policy for UPDATE (keep user-own scope)
-- ==========================================

-- UPDATE stays as-is (users can mark their own as read)
-- Delete stays as-is (users can delete their own)
