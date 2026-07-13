/*
# Plan Limits, Featured Until, and Photo Limits

1. Adds plan columns: `max_images`, `max_featured`, `featured_duration_days`, `is_active`
2. Adds `featured_until` to `listings`
3. Updates trigger to protect `featured_until` from client writes
4. Index for efficient featured count per user
5. Deactivates old plans, inserts Estándar and Premium
6. New cron to expire individual featured listings (hourly)

Run in: Supabase Dashboard SQL Editor
Idempotent: yes
*/

-- ============================================================
-- 1. New columns on subscription_plans
-- ============================================================
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS max_images int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_featured int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_duration_days int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2. featured_until on listings
-- ============================================================
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS featured_until timestamptz;

-- ============================================================
-- 3. Update trigger — also protect featured_until from client
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_direct_featured_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
       OR NEW.listing_priority IS DISTINCT FROM OLD.listing_priority
       OR NEW.featured_until IS DISTINCT FROM OLD.featured_until
    THEN
      RAISE EXCEPTION 'Only system processes can modify featured status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger (DROP + CREATE is idempotent via OR REPLACE above)
DROP TRIGGER IF EXISTS check_featured_write_trigger ON listings;
CREATE TRIGGER check_featured_write_trigger
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_featured_write();

-- ============================================================
-- 4. Index for counting active featured per user
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_listings_user_featured
  ON listings (user_id, featured_until)
  WHERE is_featured = true AND featured_until IS NOT NULL;

-- ============================================================
-- 5. Deactivate old plans, insert Estándar & Premium
-- ============================================================

-- Deactivate all existing plans (no real subscriptions depend on them)
UPDATE subscription_plans SET is_active = false WHERE is_active = true;

-- Insert new plans (idempotent via slug conflict)
INSERT INTO subscription_plans (name, slug, price, currency, features, listing_priority, max_images, max_featured, featured_duration_days, is_active)
VALUES
  ('Estándar', 'estandar', 10000, 'ARS',
   '["3 publicaciones destacadas","5 fotos por aviso","Destacado por 3 días"]'::jsonb,
   1, 5, 3, 3, true),
  ('Premium', 'premium', 15000, 'ARS',
   '["10 publicaciones destacadas","10 fotos por aviso","Destacado por 7 días"]'::jsonb,
   2, 10, 10, 7, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  listing_priority = EXCLUDED.listing_priority,
  max_images = EXCLUDED.max_images,
  max_featured = EXCLUDED.max_featured,
  featured_duration_days = EXCLUDED.featured_duration_days,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 6. Cron: expire individual featured listings (hourly)
-- ============================================================

-- Function to unfeature listings whose featured_until has passed
CREATE OR REPLACE FUNCTION expire_featured_listings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE listings
  SET is_featured = false,
      listing_priority = 0,
      featured_until = NULL
  WHERE is_featured = true
    AND featured_until IS NOT NULL
    AND featured_until < NOW();
  -- Return number of affected rows for logging if needed
  RAISE NOTICE 'Expired % featured listings', ROW_COUNT;
END;
$$;

-- Schedule daily at 00:01 Argentina time (UTC-3 → 03:01 UTC)
-- Note: unschedule via 'SELECT cron.unschedule(''expire-featured-listings'');' first if re-running
SELECT cron.schedule('expire-featured-listings', '1 3 * * *', 'SELECT expire_featured_listings();');
