# Listing Feature Toggle Specification

## Purpose

Allow users with active subscription plans to feature individual listings from the publish screen, enforcing plan slot limits server-side via an RPC.

## Requirements

### Requirement: feature_listing RPC validates plan and enforces slot limits

The system SHALL provide a `feature_listing(p_listing_id uuid)` SECURITY DEFINER RPC that verifies caller ownership, validates an active subscription, enforces `max_featured`, and sets feature columns atomically.

#### Scenario: Active plan user features a listing within slot limit

- GIVEN the authenticated user owns the listing AND has an active subscription with `max_featured = 3`
- WHEN the user calls `feature_listing(listing_id)` AND current featured count is < 3
- THEN the RPC SHALL set `is_featured = true`, `listing_priority = plan.listing_priority`, `featured_until = now() + interval '1 day' * plan.featured_duration_days`
- AND the RPC SHALL return success

#### Scenario: User exceeds max_featured slots

- GIVEN the authenticated user owns the listing AND has an active subscription with `max_featured = 1`
- WHEN the user calls `feature_listing(listing_id)` AND 1 listing is already featured
- THEN the RPC SHALL return an error indicating the slot limit is reached
- AND the listing SHALL NOT be modified

#### Scenario: User has no active subscription

- GIVEN the authenticated user owns the listing AND has no active subscription (`subscription_type = 'none'` or expired)
- WHEN the user calls `feature_listing(listing_id)`
- THEN the RPC SHALL return an error indicating no active plan

#### Scenario: User does not own the listing

- GIVEN an authenticated user who does NOT own the target listing
- WHEN they call `feature_listing(listing_id)`
- THEN the RPC SHALL return an authorization error
- AND the listing SHALL NOT be modified

### Requirement: Publish screen toggle and post-insert feature call

The publish screen SHALL display a "Destacar aviso" toggle after listing creation. After a successful INSERT, if the toggle is ON, the client SHALL call `feature_listing`.

#### Scenario: Toggle ON and RPC succeeds

- GIVEN the user published a listing with the toggle ON
- WHEN the listing INSERT succeeds AND `feature_listing` returns success
- THEN the system SHALL show a success toast "Tu aviso fue destacado correctamente"

#### Scenario: Toggle ON and RPC fails

- GIVEN the user published a listing with the toggle ON
- WHEN `feature_listing` returns an error
- THEN the system SHALL show an error toast "No se pudo destacar el aviso: {reason}"
- AND the listing SHALL still be published (unfeatured)

#### Scenario: Toggle OFF

- GIVEN the user published a listing with the toggle OFF
- WHEN the listing INSERT succeeds
- THEN the system SHALL NOT call `feature_listing`
- AND no toast SHALL be shown

### Requirement: Banner when user has no active plan

The publish screen SHALL check subscription status and display a banner prompting plan selection when the user lacks an active plan.

#### Scenario: No active subscription shows banner

- GIVEN `profile.subscription_type = 'none'` OR `subscription_expires_at <= now()`
- WHEN the publish screen renders
- THEN a banner SHALL be shown with text "Suscribite a un plan para destacar tus avisos"
- AND a "Ver planes" button SHALL navigate to `/plans`
- AND the feature toggle SHALL be hidden or disabled

#### Scenario: Active subscription hides banner

- GIVEN `profile.subscription_type != 'none'` AND `subscription_expires_at > now()`
- WHEN the publish screen renders
- THEN no banner SHALL be shown
- AND the feature toggle SHALL be available
