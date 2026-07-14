/*
# Backfill featured_until for Existing Featured Listings

One-time migration: sets `featured_until` for currently featured listings
that have `featured_until IS NULL`. Joins through subscriptions + subscription_plans
to get the correct duration.

Listings from cancelled/expired subscriptions without featured_until stay as-is
(the daily cron will not expire them since featured_until IS NULL, but they'll
be cleaned up on next subscription event or manual admin action).

Run in: Supabase Dashboard SQL Editor
Idempotent: yes (WHERE clause skips already-backfilled rows)
*/

UPDATE listings l
SET featured_until = l.created_at + (sp.featured_duration_days || ' days')::interval
FROM subscriptions s
JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE l.user_id = s.user_id
  AND l.is_featured = true
  AND l.featured_until IS NULL
  AND s.status = 'active';
