/*
# Umpi Seed Data

Inserts default categories, subscription plans, and mock listing data.
*/

INSERT INTO categories (name, slug, icon, image_url, total_count) VALUES
  ('Todos', 'todos', 'Sparkles', 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg', 0),
  ('Servicios', 'servicios', 'Wrench', 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg', 14230),
  ('Autos', 'autos', 'Car', 'https://images.pexels.com/photos/1149137/pexels-photo-1149137.jpeg', 8940),
  ('Propiedades', 'propiedades', 'Home', 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg', 6100),
  ('Tecnologia', 'tecnologia', 'Laptop', 'https://images.pexels.com/photos/40185/mac-freelancer-macintosh-macbook-40185.jpeg', 5200),
  ('Restoranes', 'restoranes', 'UtensilsCrossed', 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg', 3100),
  ('Cafeterias', 'cafeterias', 'Coffee', 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg', 2800),
  ('Bares', 'bares', 'Wine', 'https://images.pexels.com/photos/1242321/pexels-photo-1242321.jpeg', 2200),
  ('Destacados', 'destacados', 'Star', 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg', 0)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subscription_plans (name, slug, price, currency, features, listing_priority) VALUES
  ('Plata', 'plata', 7000, 'ARS', '["1 destacado","Visibilidad basica","1 semana"]', 1),
  ('Oro', 'oro', 8000, 'ARS', '["3 destacados","Visibilidad media","2 semanas","Badge Oro"]', 2),
  ('Premium', 'premium', 10000, 'ARS', '["5 destacados","Maxima visibilidad","1 mes","Badge Premium","Sin publicidad"]', 3)
ON CONFLICT (slug) DO NOTHING;
