/*
# MercadoPago Subscription Fields + Security

1. Adds `mp_preapproval_id` (UNIQUE) and `external_reference` to `subscriptions`
2. Trigger to prevent client-side writes to `is_featured` / `listing_priority`
3. `expire_subscriptions()` function for daily cron cleanup
4. Schedule `expire_subscriptions()` via pg_cron daily at 3AM
5. Tighten RLS on `subscriptions`: owner-scoped reads, service-role writes only

Important:
- Run this in the Supabase Dashboard SQL Editor (no Supabase CLI configured)
- Idempotent — safe to run multiple times
- Requires pg_cron extension (pre-installed in all Supabase projects)
*/

-- 1. Add MercadoPago columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text,
  ADD COLUMN IF NOT EXISTS external_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_mp_preapproval_id
  ON subscriptions (mp_preapproval_id);

-- 2. Trigger: prevent client-side writes to featured/priority columns
CREATE OR REPLACE FUNCTION prevent_direct_featured_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
       OR NEW.listing_priority IS DISTINCT FROM OLD.listing_priority
    THEN
      RAISE EXCEPTION 'Only system processes can modify featured status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_featured_write_trigger ON listings;
CREATE TRIGGER check_featured_write_trigger
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_featured_write();

-- 3. expire_subscriptions() — batch-expire overdue subscriptions
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub RECORD;
BEGIN
  FOR sub IN
    SELECT id, user_id FROM subscriptions
    WHERE status = 'active' AND expires_at < NOW()
  LOOP
    UPDATE subscriptions SET status = 'expired' WHERE id = sub.id;
    UPDATE profiles SET subscription_type = 'none' WHERE id = sub.user_id;
    UPDATE listings SET is_featured = false, listing_priority = 0 WHERE user_id = sub.user_id;
  END LOOP;
END;
$$;

-- 4. Enable pg_cron extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- Schedule cron job daily at 3AM Argentina time (UTC-3 → UTC 6AM)
-- First run: safe schedule (unschedule may fail if job doesn't exist yet)
SELECT cron.schedule('expire-subscriptions', '0 6 * * *', 'SELECT expire_subscriptions();');

-- 5. Tighten RLS on subscriptions — owner-scoped reads, no user writes
-- (SELECT stays owner-scoped as before; INSERT/UPDATE/DELETE removed from users)
DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
