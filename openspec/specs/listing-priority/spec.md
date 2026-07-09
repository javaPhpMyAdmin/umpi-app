# Listing Priority Specification

## Purpose

Ensure featured listings (from paid subscriptions) appear before regular listings in browsing experiences — home carousel and explore — and that feature benefits are automatically revoked when subscriptions end.

## Requirements

### Requirement: Home carousel priority ordering

The home carousel on `app/(tabs)/index.tsx` MUST order listings by `listing_priority DESC, created_at DESC`. Listings with higher priority values MUST appear first.

#### Scenario: Featured listings appear first

- GIVEN a set of listings with varying `listing_priority` values (3, 1, 0, 2)
- WHEN the home carousel query executes
- THEN listings MUST be ordered: priority 3 first, then 2, then 1, then 0
- AND within the same priority level, ordering MUST be by `created_at DESC`

#### Scenario: Non-featured listings (priority = 0) appear last

- GIVEN listings with `listing_priority = 0` (free tier)
- WHEN the home carousel renders
- THEN all priority-0 listings MUST appear after any listing with priority > 0
- AND they MUST still be ordered by `created_at DESC` among themselves

### Requirement: Explore and infinite queries use priority ordering

The explore screen and `useListingsInfinite` hook MUST use `listing_priority DESC` as the primary sort criterion, followed by `created_at DESC`.

#### Scenario: Explore infinite scroll respects priority

- GIVEN the user scrolls through the explore results
- WHEN the infinite query fetches subsequent pages
- THEN each page MUST be ordered by `listing_priority DESC, created_at DESC`
- AND cursor-based pagination MUST use the combined sort order

#### Scenario: Filter+sort coexistence

- GIVEN the user applies a category filter on the explore screen
- WHEN the filtered query executes
- THEN the filter MUST apply first (WHERE clause)
- AND priority ordering MUST still apply to the filtered results

### Requirement: Auto-unfeature on subscription cancellation or expiration

When a subscription is cancelled (via user action) or expires (via cron), ALL of that user's listings MUST have `is_featured = false` and `listing_priority = 0` set immediately.

#### Scenario: Cancel unfeatures all listings

- GIVEN a user has 5 listings with `is_featured = true` and `listing_priority = 2`
- WHEN the subscription is cancelled (by user or webhook)
- THEN ALL 5 listings MUST have `is_featured = false` and `listing_priority = 0`
- AND the update MUST be atomic (all or none)

#### Scenario: Expired cron unfeatures listings

- GIVEN a subscription expired and the cron job runs
- WHEN the cron updates the subscription
- THEN ALL listings belonging to that user MUST be set to `is_featured = false` and `listing_priority = 0`
- AND listings that were already unfeatured MUST NOT be affected negatively (no-op is safe)

### Requirement: Data integrity for featured listings

The system MUST prevent manual (non-MP-authorized) setting of `listing_priority > 0` or `is_featured = true` outside the subscription flow. Only the Edge Functions and the cron job (running with service role) MUST be able to set feature-related columns.

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
