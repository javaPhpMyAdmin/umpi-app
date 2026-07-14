/*
# Rename Oro → Premium (name + slug)

The plan was renamed from Premium → Oro in migration 7, but the client wants
Premium back. Keeps the same pricing and limits:
  - Premium: $30.000, 10 featured, 20 photos, 30 days

Idempotent: yes
*/

UPDATE subscription_plans
SET
  name = 'Premium',
  slug = 'premium'
WHERE slug = 'oro';
