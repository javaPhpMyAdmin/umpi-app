/*
# Add listing_id to reviews + public RLS

1. Adds `listing_id` column to `reviews` (denormalization for direct queries)
2. Trigger auto-fills `listing_id` from the conversation on INSERT
3. Index for fast queries by listing
4. Public RLS policy: authenticated users can see reviews for active listings
5. Backfill existing reviews
*/

-- 1. Add listing_id column
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES listings(id) ON DELETE CASCADE;

-- 2. Index for direct query: reviews by listing, newest first
CREATE INDEX IF NOT EXISTS idx_reviews_listing_created
  ON reviews (listing_id, created_at DESC);

-- 3. Trigger: auto-fill listing_id from conversation (never trust the client)
CREATE OR REPLACE FUNCTION fn_fill_review_listing_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  SELECT listing_id INTO NEW.listing_id
  FROM conversations
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_review_listing_id ON reviews;
CREATE TRIGGER trg_fill_review_listing_id
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION fn_fill_review_listing_id();

-- 4. Backfill existing reviews with their conversation's listing_id
UPDATE reviews r
SET listing_id = c.listing_id
FROM conversations c
WHERE c.id = r.conversation_id
  AND r.listing_id IS NULL;

-- Set NOT NULL after backfill (safe now)
ALTER TABLE reviews ALTER COLUMN listing_id SET NOT NULL;

-- 5. Public RLS: authenticated users can see reviews for active listings
-- (keeps existing participant policy intact — both apply via OR)
CREATE POLICY "reviews_select_public" ON reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = reviews.listing_id
      AND status = 'active'
    )
  );
