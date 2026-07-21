# Featured Listings Specification

## Purpose

Dedicated screen for browsing all featured/priority listings with infinite scroll. Separates featured content from generic explore to increase visibility of paid subscriber listings.

## Requirements

### Requirement: Featured listings screen renders as standalone route

The system MUST provide a standalone screen at route `/featured` that displays all featured listings. The screen MUST render without the tab bar navigation.

#### Scenario: User navigates to featured screen

- GIVEN the user is on any screen in the app
- WHEN the user navigates to `/featured`
- THEN the featured listings screen MUST render
- AND the tab bar MUST NOT be visible
- AND the screen title MUST display "Destacados"

#### Scenario: Back navigation from featured screen

- GIVEN the user is on the featured screen
- WHEN the user taps the back button
- THEN the user MUST return to the previous screen
- AND no tab state MUST be altered

### Requirement: Infinite scroll pagination with 20 items per page

The featured screen MUST use the `useListingsInfinite` hook with `filter: 'featured'` and `sortBy: 'priority'` to fetch paginated results. Each page MUST return up to 20 items ordered by `listing_priority DESC, created_at DESC`.

#### Scenario: Initial load fetches first page

- GIVEN the user opens the featured screen
- WHEN the screen mounts
- THEN the system MUST fetch the first page of featured listings
- AND up to 20 listings MUST be displayed in a 2-column grid
- AND each listing MUST render as a compact `ListingCard`

#### Scenario: Scrolling triggers next page fetch

- GIVEN the first page of listings is loaded and displayed
- WHEN the user scrolls near the bottom of the list
- THEN the system MUST fetch the next page of featured listings
- AND append the results to the existing list
- AND a loading indicator MUST display while fetching

#### Scenario: Last page reached stops pagination

- GIVEN all featured listings have been fetched
- WHEN the user scrolls to the bottom
- THEN no additional requests MUST be made
- AND the loading indicator MUST NOT appear

### Requirement: TanStack Query caching

Featured listings MUST use TanStack Query with a `staleTime` of 60 seconds, consistent with the `useListings` hook behavior. Query keys MUST be distinct from explore screen keys (different filter params ensure natural separation).

#### Scenario: Returning to featured screen uses cache

- GIVEN the user visited the featured screen within the last 60 seconds
- WHEN the user navigates away and returns
- THEN the cached listings MUST be displayed immediately
- AND no network request MUST fire until staleTime expires

### Requirement: Pull-to-refresh

The featured screen MUST support pull-to-refresh to allow the user to manually invalidate and refetch the listing data.

#### Scenario: User pulls to refresh

- GIVEN the user is on the featured screen with loaded listings
- WHEN the user performs a pull-to-refresh gesture
- THEN the system MUST refetch the first page of featured listings
- AND replace the current list with fresh results
- AND a refresh indicator MUST display during the fetch

### Requirement: Empty state with plan upsell

When no featured listings exist, the system MUST display an empty state with a message and a call-to-action that navigates to `/plans`.

#### Scenario: No featured listings exist

- GIVEN the featured query returns zero results
- WHEN the screen renders
- THEN an empty state message MUST be displayed
- AND a "Ver planes" CTA button MUST be visible
- AND tapping the CTA MUST navigate to `/plans`

#### Scenario: Empty state after all listings removed

- GIVEN the user has loaded featured listings
- WHEN all listings are deleted or unfeatured and the user pulls to refresh
- THEN the screen MUST transition to the empty state
- AND the "Ver planes" CTA MUST be visible
