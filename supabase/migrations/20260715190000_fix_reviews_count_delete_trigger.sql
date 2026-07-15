/*
# Fix reviews_count trigger on DELETE + backfill stale counts

## Bug
`fn_recalculate_ratings` uses `r.id = COALESCE(NEW.id, OLD.id)` to find the
affected review AFTER the DELETE. Since it's an AFTER DELETE trigger, the row
is already gone → `v_seller_id` = NULL → recount never runs on the affected
listing. This leaves `reviews_count` inflated.

## Fix
1. Grab `conversation_id` directly from `OLD`/`NEW` instead of re-querying
   the (potentially deleted) review row.
2. Also handle UPDATE of conversation_id: recalculate BOTH old and new listings
   so neither gets a stale count.
3. Backfill all listings and profiles so stale data is corrected.
*/

-- 1. Replace trigger function with fixed DELETE + UPDATE handling
CREATE OR REPLACE FUNCTION fn_recalculate_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_seller_id uuid;
  v_new_seller_id uuid;
BEGIN
  -- When conversation_id changes (UPDATE), recalculate BOTH old and new listings
  IF TG_OP = 'UPDATE' AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    -- Old conversation's listing (may lose a review)
    SELECT l.user_id INTO v_old_seller_id
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    WHERE c.id = OLD.conversation_id;

    IF v_old_seller_id IS NOT NULL THEN
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
      WHERE user_id = v_old_seller_id;

      UPDATE profiles
      SET
        rating = COALESCE(
          (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
           JOIN conversations c ON c.id = r.conversation_id
           JOIN listings l ON l.id = c.listing_id
           WHERE l.user_id = v_old_seller_id),
          5.0
        ),
        reviews_count = (
          SELECT COUNT(*) FROM reviews r
          JOIN conversations c ON c.id = r.conversation_id
          JOIN listings l ON l.id = c.listing_id
          WHERE l.user_id = v_old_seller_id
        )
      WHERE id = v_old_seller_id;
    END IF;

    -- New conversation's listing (gains a review)
    SELECT l.user_id INTO v_new_seller_id
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    WHERE c.id = NEW.conversation_id;

    IF v_new_seller_id IS NOT NULL AND (v_new_seller_id IS DISTINCT FROM v_old_seller_id) THEN
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
      WHERE user_id = v_new_seller_id;

      UPDATE profiles
      SET
        rating = COALESCE(
          (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
           JOIN conversations c ON c.id = r.conversation_id
           JOIN listings l ON l.id = c.listing_id
           WHERE l.user_id = v_new_seller_id),
          5.0
        ),
        reviews_count = (
          SELECT COUNT(*) FROM reviews r
          JOIN conversations c ON c.id = r.conversation_id
          JOIN listings l ON l.id = c.listing_id
          WHERE l.user_id = v_new_seller_id
        )
      WHERE id = v_new_seller_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
  END IF;

  -- For DELETE: use OLD.conversation_id directly (row is gone, can't re-query)
  -- For INSERT and plain UPDATE: use NEW.conversation_id
  SELECT l.user_id INTO v_new_seller_id
  FROM conversations c
  JOIN listings l ON l.id = c.listing_id
  WHERE c.id = COALESCE(NEW.conversation_id, OLD.conversation_id);

  IF v_new_seller_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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
  WHERE user_id = v_new_seller_id;

  -- Update profile-level rating (avg across ALL reviews) and reviews_count
  UPDATE profiles
  SET
    rating = COALESCE(
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
       JOIN conversations c ON c.id = r.conversation_id
       JOIN listings l ON l.id = c.listing_id
       WHERE l.user_id = v_new_seller_id),
      5.0
    ),
    reviews_count = (
      SELECT COUNT(*) FROM reviews r
      JOIN conversations c ON c.id = r.conversation_id
      JOIN listings l ON l.id = c.listing_id
      WHERE l.user_id = v_new_seller_id
    )
  WHERE id = v_new_seller_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Backfill all listings (fixes stale counts from the DELETE bug)
UPDATE listings l
SET
  rating = COALESCE(
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
     JOIN conversations c ON c.id = r.conversation_id
     WHERE c.listing_id = l.id),
    5.0
  ),
  reviews_count = (
    SELECT COUNT(*) FROM reviews r
    JOIN conversations c ON c.id = r.conversation_id
    WHERE c.listing_id = l.id
  );

-- 3. Backfill all profiles (recalculate from scratch)
UPDATE profiles p
SET
  rating = COALESCE(
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
     JOIN conversations c ON c.id = r.conversation_id
     JOIN listings l ON l.id = c.listing_id
     WHERE l.user_id = p.id),
    5.0
  ),
  reviews_count = (
    SELECT COUNT(*) FROM reviews r
    JOIN conversations c ON c.id = r.conversation_id
    JOIN listings l ON l.id = c.listing_id
    WHERE l.user_id = p.id
  );
