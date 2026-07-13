-- Allow unauthenticated users to see reviews for active listings.
-- "reviews_select_public" was scoped to TO authenticated only, which meant
-- anon users got zero rows. Reviews on active listings are public content
-- (like MercadoLibre) — no login needed.

ALTER POLICY "reviews_select_public" ON reviews
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = reviews.listing_id
      AND status = 'active'
    )
  );
