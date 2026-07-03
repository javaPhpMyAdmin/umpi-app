
INSERT INTO categories (id, name, slug, icon, total_count, is_active)
VALUES
  (gen_random_uuid(), 'Servicios', 'servicios', 'Wrench', 0, true),
  (gen_random_uuid(), 'Vehiculos', 'vehiculos', 'Car', 0, true),
  (gen_random_uuid(), 'Inmuebles', 'inmuebles', 'Home', 0, true),
  (gen_random_uuid(), 'Tecnologia', 'tecnologia', 'Laptop', 0, true),
  (gen_random_uuid(), 'Alimentos', 'alimentos', 'UtensilsCrossed', 0, true),
  (gen_random_uuid(), 'Bebidas', 'bebidas', 'Coffee', 0, true),
  (gen_random_uuid(), 'Entretenimiento', 'entretenimiento', 'Wine', 0, true),
  (gen_random_uuid(), 'Bienestar', 'bienestar', 'Sparkles', 0, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subscription_plans (name, slug, price, currency, features, listing_priority)
VALUES
  ('Basico', 'basico', 7000, 'ARS', '["Destacado en tu ciudad", "Logo verificado", "Badge profesional"]', 1),
  ('Profesional', 'profesional', 14000, 'ARS', '["Destacado a nivel nacional", "Logo verificado", "Badge profesional", "Soporte prioritario"]', 2),
  ('Premium', 'premium', 28000, 'ARS', '["Destacado en toda Argentina", "Logo verificado", "Badge profesional", "Soporte prioritario", "Analiticas avanzadas"]', 3)
ON CONFLICT (slug) DO NOTHING;
