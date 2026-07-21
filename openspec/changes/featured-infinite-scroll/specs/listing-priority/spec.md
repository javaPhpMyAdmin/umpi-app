# Delta for Listing Priority

## MODIFIED Requirements

### Requirement: Home carousel priority ordering

The home carousel on `app/(tabs)/index.tsx` MUST order listings by `listing_priority DESC, created_at DESC`. Listings with higher priority values MUST appear first. The "Ver todos" link in the featured section MUST navigate to `/featured` instead of `/explore`.

(Previously: "Ver todos" navigated to `/explore`)

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

#### Scenario: Ver todos navigates to featured screen

- GIVEN the user is on the home screen with featured listings displayed
- WHEN the user taps "Ver todos" in the featured section
- THEN the user MUST navigate to `/featured`
- AND the featured listings screen MUST load with infinite scroll
