# Delta for Listing Priority

## MODIFIED Requirements

### Requirement: Data integrity for featured listings

The system MUST prevent manual (non-MP-authorized) setting of `listing_priority > 0` or `is_featured = true` outside the subscription flow. Only the Edge Functions, the cron job (running with service role), and the `feature_listing` SECURITY DEFINER RPC MUST be able to set feature-related columns.
(Previously: Only Edge Functions and cron could set feature columns — no user-initiated feature path existed.)

#### Scenario: User tries to manually feature a listing

- GIVEN the authenticated user
- WHEN they attempt to `UPDATE` their listing setting `is_featured = true` or `listing_priority = 1`
- THEN the RLS policy MUST reject the write
- AND the listing MUST remain unfeatured

#### Scenario: Edge function sets feature columns

- GIVEN the Edge Function processes an authorized webhook
- WHEN it updates the user's listings
- THEN the update MUST succeed (using service_role key bypasses RLS)
- AND all affected listings MUST have matching `is_featured = true` and correct `listing_priority`

#### Scenario: feature_listing RPC sets feature columns

- GIVEN the authenticated user calls `feature_listing(listing_id)` with a valid plan
- WHEN the RPC executes
- THEN it MUST set `is_featured = true`, `listing_priority`, and `featured_until` atomically
- AND the update MUST succeed (SECURITY DEFINER bypasses client-side RLS triggers)
