/*
# Add featured_used and period_start to subscriptions

Tracks how many featured listings the user has used in the current billing period.
period_start is set by the webhook on each authorized event (subscription/renewal).
The RPC resets featured_used automatically if period_start + duration > now()
(red de seguridad in case the webhook fails to fire).

Run in: Supabase Dashboard SQL Editor
Idempotent: yes
*/

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS featured_used INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ DEFAULT now();
