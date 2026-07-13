/*
# Schedule subscription expiry notification cron

Schedules `fn_check_subscription_expiry()` via pg_cron to run daily
at 3AM Argentina time (same time as `expire-subscriptions`).

pg_cron extension was enabled in `20260709000001_add_mp_fields.sql`.
*/

-- Remove existing schedule if re-running (safe — catches missing job)
DO $$
BEGIN
  PERFORM cron.unschedule('check-subscription-expiry');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist yet, that's fine
END;
$$;

-- Schedule daily at 3AM Argentina (UTC-3 → 6AM UTC)
SELECT cron.schedule(
  'check-subscription-expiry',
  '0 6 * * *',
  'SELECT fn_check_subscription_expiry();'
);
