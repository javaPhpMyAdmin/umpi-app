-- Add reviews_count to profiles for seller reputation display
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

-- Update trigger function to also set profiles.reviews_count
CREATE OR REPLACE FUNCTION fn_recalculate_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  -- Get the seller (listing owner) from the affected conversation
  SELECT l.user_id INTO v_seller_id
  FROM reviews r
  JOIN conversations c ON c.id = r.conversation_id
  JOIN listings l ON l.id = c.listing_id
  WHERE r.id = COALESCE(NEW.id, OLD.id);

  -- Update listing-level rating and reviews_count
  UPDATE listings
  SET
    rating = COALESCE(
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
       JOIN conversations c ON c.id = r.conversation_id
       WHERE c.listing_id = listings.id),
      listings.rating
    ),
    reviews_count = (
      SELECT COUNT(*) FROM reviews r
      JOIN conversations c ON c.id = r.conversation_id
      WHERE c.listing_id = listings.id
    )
  WHERE user_id = v_seller_id;

  -- Update profile-level rating (avg across ALL reviews) and reviews_count
  UPDATE profiles
  SET
    rating = COALESCE(
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
       JOIN conversations c ON c.id = r.conversation_id
       JOIN listings l ON l.id = c.listing_id
       WHERE l.user_id = v_seller_id),
      5.0
    ),
    reviews_count = (
      SELECT COUNT(*) FROM reviews r
      JOIN conversations c ON c.id = r.conversation_id
      JOIN listings l ON l.id = c.listing_id
      WHERE l.user_id = v_seller_id
    )
  WHERE id = v_seller_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
