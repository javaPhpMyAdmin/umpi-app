/*
# Cleanup Old Plans + Fix Stale listing_priority

1. Removes inactive/obsolete plans (Plata, Basico, Profesional)
2. Fixes listing with stale listing_priority = 3 (from old Premium) → 1 (Estándar)
*/

-- 1. Remove obsolete plans
DELETE FROM subscription_plans WHERE slug IN ('plata', 'basico', 'profesional');

-- 2. Fix stale priority from old Premium (3) → Estándar level (1)
UPDATE listings
SET listing_priority = 1
WHERE id = '21e09715-3994-4b39-82e4-6314efc59361'
  AND listing_priority = 3;
