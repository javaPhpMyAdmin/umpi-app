/*
# Cleanup old categories + reassign listings to new categories

1. Deletes ALL old inactive categories (except 'todos' and 'destacados')
2. Re-assigns existing listings to the correct new category based on title keywords
   so the category filter works again.

Idempotent: yes (safe to re-run)
*/

-- ============================================================
-- 1. Delete old inactive categories (keeping 'todos' and 'destacados')
-- ============================================================
DELETE FROM categories
WHERE is_active = false
  AND slug NOT IN ('todos', 'destacados');

-- ============================================================
-- 2. Re-assign listings to new categories based on title
-- ============================================================

-- Autos/motos
UPDATE listings
SET category_id = (SELECT id FROM categories WHERE slug = 'autos-motos')
WHERE category_id IS NULL
  AND (
    title ILIKE '%auto%'
    OR title ILIKE '%moto%'
    OR title ILIKE '%vehiculo%'
  );

-- Inmuebles (alquiler va aquí, no en autos)
UPDATE listings
SET category_id = (SELECT id FROM categories WHERE slug = 'inmuebles')
WHERE category_id IS NULL
  AND (
    title ILIKE '%casa%'
    OR title ILIKE '%departamento%'
    OR title ILIKE '%alquiler%'
    OR title ILIKE '%inmueble%'
    OR title ILIKE '%propiedad%'
  );

-- Resto/Bares/Cafeterías
UPDATE listings
SET category_id = (SELECT id FROM categories WHERE slug = 'resto-bares-cafeterias')
WHERE category_id IS NULL
  AND (
    title ILIKE '%cafe%'
    OR title ILIKE '%cafeteria%'
    OR title ILIKE '%resto%'
    OR title ILIKE '%bar%'
    OR title ILIKE '%helado%'
    OR title ILIKE '%comida%'
    OR title ILIKE '%gastronomia%'
  );

-- Celulares/accesorios
UPDATE listings
SET category_id = (SELECT id FROM categories WHERE slug = 'celulares-accesorios')
WHERE category_id IS NULL
  AND (
    title ILIKE '%celular%'
    OR title ILIKE '%telefono%'
    OR title ILIKE '%accesorio%'
    OR title ILIKE '%tablet%'
    OR title ILIKE '%notebook%'
    OR title ILIKE '%laptop%'
    OR title ILIKE '%computadora%'
    OR title ILIKE '%tecnologia%'
  );

-- Everything else → Servicios/comercios
UPDATE listings
SET category_id = (SELECT id FROM categories WHERE slug = 'servicios-comercios')
WHERE category_id IS NULL;
