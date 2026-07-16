/*
# Add Composite Index for Price Sorting on Explore

The explore screen now lets users sort by price.  
Without a composite index on `(status, price, created_at DESC)`, Postgres
would filter by `status='active'` using `idx_listings_status` and then sort
all matching rows in memory — expensive for large datasets.

This index lets Postgres scan the exact rows needed in the right order.

Run in: Supabase Dashboard SQL Editor
Idempotent: yes
*/

CREATE INDEX IF NOT EXISTS idx_listings_status_price
  ON listings (status, price, created_at DESC);
