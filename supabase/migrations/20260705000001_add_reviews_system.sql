-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text CHECK (char_length(comment) <= 500),
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, reviewer_id)
);

-- Add reviews_count to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

-- Trigger function
CREATE OR REPLACE FUNCTION fn_recalculate_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_listing_id uuid;
  v_seller_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT listing_id INTO v_listing_id FROM conversations WHERE id = OLD.conversation_id;
  ELSE
    SELECT listing_id INTO v_listing_id FROM conversations WHERE id = NEW.conversation_id;
  END IF;

  -- Get seller
  SELECT user_id INTO v_seller_id FROM listings WHERE id = v_listing_id;

  -- Update the listing's average rating and count
  UPDATE listings
  SET
    rating = COALESCE(
      (SELECT ROUND(AVG(r), 1) FROM (
        SELECT r.rating FROM reviews r
        JOIN conversations c ON c.id = r.conversation_id
        WHERE c.listing_id = v_listing_id
      ) sub),
      5.0
    ),
    reviews_count = (
      SELECT COUNT(*) FROM reviews r
      JOIN conversations c ON c.id = r.conversation_id
      WHERE c.listing_id = v_listing_id
    )
  WHERE id = v_listing_id;

  -- Update the seller's overall profile rating
  UPDATE profiles
  SET rating = COALESCE(
    (SELECT ROUND(AVG(rating), 1) FROM listings WHERE user_id = v_seller_id),
    5.0
  )
  WHERE id = v_seller_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_recalculate_ratings ON reviews;
CREATE TRIGGER trg_recalculate_ratings
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION fn_recalculate_ratings();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_conversation ON reviews(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Select: participants see their own conversation's reviews
DROP POLICY IF EXISTS "reviews_select_participant" ON reviews;
CREATE POLICY "reviews_select_participant" ON reviews FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = reviews.conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- Insert: participant, not listing owner, and rate as yourself
DROP POLICY IF EXISTS "reviews_insert_participant" ON reviews;
CREATE POLICY "reviews_insert_participant" ON reviews FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN listings l ON l.id = c.listing_id
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
      AND l.user_id != auth.uid()
    )
  );

-- Update/Delete not supported (out of scope)
DROP POLICY IF EXISTS "reviews_no_update" ON reviews;
CREATE POLICY "reviews_no_update" ON reviews FOR UPDATE
  TO authenticated USING (false);

DROP POLICY IF EXISTS "reviews_no_delete" ON reviews;
CREATE POLICY "reviews_no_delete" ON reviews FOR DELETE
  TO authenticated USING (false);
