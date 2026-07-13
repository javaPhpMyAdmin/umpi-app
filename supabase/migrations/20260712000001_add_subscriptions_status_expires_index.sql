/*
# Add composite index on subscriptions (status, expires_at)

Both `expire_subscriptions()` and `fn_check_subscription_expiry()` filter on
`status = 'active' AND expires_at`. A composite index prevents sequential scans.
*/

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires
  ON subscriptions (status, expires_at);
