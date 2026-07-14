/*
# Update plan prices, rename Premium → Oro, adjust limits

1. Update Estándar: price=5900, max_featured=1, max_images=10, featured_duration_days=30
2. Rename Premium → Oro: name='Oro', slug='oro', price=30000, max_featured=10, max_images=20, featured_duration_days=30

Run in: Supabase Dashboard SQL Editor
Idempotent: yes
*/

-- Remove the old deactivated 'oro' slug row (from seed v1) to avoid unique conflict
DELETE FROM subscription_plans WHERE slug = 'oro' AND is_active = false;

-- Update Estándar
UPDATE subscription_plans
SET
  price = 5900,
  max_featured = 1,
  max_images = 10,
  featured_duration_days = 30
WHERE slug = 'estandar';

-- Rename Premium → Oro with new limits
UPDATE subscription_plans
SET
  name = 'Oro',
  slug = 'oro',
  price = 30000,
  max_featured = 10,
  max_images = 20,
  featured_duration_days = 30
WHERE slug = 'premium';
