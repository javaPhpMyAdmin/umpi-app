/*
# Cities table + Category update

1. Creates `cities` table and populates with 14 localities
2. Adds `city_id` FK to `listings`
3. Deactivates old categories, inserts 5 new ones
4. Clears old category_id references from listings

Run in: Supabase Dashboard SQL Editor
Idempotent: yes
*/

-- ================================
-- 1. CITIES TABLE
-- ================================
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL
);

-- Populate (idempotent — skip if slug already exists)
INSERT INTO cities (name, slug) VALUES
  ('Zapala', 'zapala'),
  ('Cutral Co/Plaza Huincul', 'cutral-co-plaza-huincul'),
  ('Chos Malal', 'chos-malal'),
  ('Loncopué', 'loncopue'),
  ('Las Lajas', 'las-lajas'),
  ('Villa Pehuenia/Moquehue', 'villa-pehuenia-moquehue'),
  ('Alumine', 'alumine'),
  ('Junín de los Andes', 'junin-de-los-andes'),
  ('San Martín de los Andes', 'san-martin-de-los-andes'),
  ('Caviahue/Copahue', 'caviahue-copahue'),
  ('El Huecú', 'el-huecu'),
  ('Rincón de los Sauces', 'rincon-de-los-sauces'),
  ('Las Ovejas/Andacollo', 'las-ovejas-andacollo'),
  ('Buta Ranquil', 'buta-ranquil')
ON CONFLICT (slug) DO NOTHING;

-- ================================
-- 2. ADD city_id TO LISTINGS
-- ================================
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id);

CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city_id);

-- ================================
-- 3. UPDATE CATEGORIES
-- ================================

-- Deactivate all old categories
UPDATE categories SET is_active = false WHERE is_active = true;

-- Insert new categories (idempotent by slug)
INSERT INTO categories (name, slug, icon, is_active) VALUES
  ('Autos/motos', 'autos-motos', 'Car', true),
  ('Inmuebles', 'inmuebles', 'Home', true),
  ('Resto/Bares/Cafeterías', 'resto-bares-cafeterias', 'UtensilsCrossed', true),
  ('Celulares/accesorios', 'celulares-accesorios', 'Smartphone', true),
  ('Servicios/comercios', 'servicios-comercios', 'Store', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

-- Clear old category references from listings
UPDATE listings SET category_id = NULL WHERE category_id IS NOT NULL;
