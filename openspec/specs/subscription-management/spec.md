# Subscription Management Specification

## Purpose

Let users view available subscription plans, track their active subscription status, cancel when desired, and handle automatic expiration clean-up via a daily cron job.

## Requirements

### Requirement: Display subscription plans from database

The plans screen MUST fetch available plans from the `subscription_plans` table instead of relying on hardcoded mock data. Plans MUST match the DB seed: Basico ($7k, priority 1), Profesional ($14k, priority 2), Premium ($28k, priority 3).

#### Scenario: Plans load from database

- GIVEN the user navigates to the plans screen
- WHEN the screen renders
- THEN it MUST query `subscription_plans` ordered by `price ASC`
- AND display each plan's name, price (formatted in ARS), and feature list
- AND MUST NOT fall back to hardcoded mock data if the table is empty — show empty state instead

#### Scenario: Database query fails

- GIVEN the `subscription_plans` query fails
- WHEN the plans screen renders
- THEN the system MUST show an error state with a "Reintentar" button
- AND MUST NOT show stale hardcoded plan data

#### Scenario: User without subscription sees no active plan

- GIVEN the authenticated user has no subscription row or `subscription_type` is null
- WHEN the user views the plans or profile screen
- THEN the profile MUST show "Sin plan" or "Sin suscripcion activa"
- AND the "Elegir plan" button on the plans screen MUST be enabled

### Requirement: Show active subscription in profile

The profile screen MUST display the user's current plan name, subscription status, and expiration date when they have an active subscription.

#### Scenario: Active subscription displayed

- GIVEN the authenticated user has an active subscription with `subscription_type` set
- WHEN the profile screen renders
- THEN it MUST show the plan name (mapped from `subscription_type`)
- AND the expiration date formatted as "dd de MMMM de yyyy"
- AND the status as "Activo"

#### Scenario: Subscription about to expire

- GIVEN the subscription expires within 7 days
- WHEN the profile screen renders
- THEN the system SHOULD show a warning "Tu plan vence pronto"
- AND the expiration date MUST still be displayed

### Requirement: Cancel subscription from profile

The authenticated user MUST be able to cancel their active subscription from the profile screen. Cancellation MUST call the MP API to suspend the PreApproval and update the local DB.

#### Scenario: Successful cancellation

- GIVEN the user has an active subscription
- WHEN the user taps "Cancelar suscripcion"
- THEN a confirmation dialog MUST appear asking "¿Cancelar suscripcion?"
- WHEN the user confirms
- THEN the system MUST call the MP API to cancel the PreApproval
- AND set `subscription_type = null` in the local DB
- AND unfeature all user's listings (`is_featured = false`, `listing_priority = 0`)
- AND show success toast "Suscripcion cancelada"
- AND the profile MUST show "Sin plan"

#### Scenario: Cancel when no active subscription

- GIVEN the user has no active subscription
- WHEN the profile screen renders
- THEN the "Cancelar suscripcion" button MUST NOT appear
- AND "Sin plan" or the available plans MUST be shown instead

#### Scenario: MP API cancellation fails

- GIVEN the user confirms cancellation
- WHEN the MP API call to cancel the PreApproval fails
- THEN the system MUST show error toast "Error al cancelar en MercadoPago"
- AND MUST NOT update the local subscription state
- AND MUST NOT unfeature the user's listings

### Requirement: Daily cron for expired subscriptions

A daily cron job MUST identify subscriptions past `expires_at`, set `subscription_type = null`, unfeature all associated listings (`is_featured = false`, `listing_priority = 0`), and mark the subscription as expired.

#### Scenario: Cron unfeatures expired subscription

- GIVEN a subscription has `expires_at` in the past
- AND the cron job runs
- WHEN the job queries for expired subscriptions
- THEN it MUST set `subscription_type = null` for that user
- AND set `is_featured = false` and `listing_priority = 0` on all their listings
- AND update the subscription record with status = 'expired'

#### Scenario: Multiple expired subscriptions processed

- GIVEN multiple users have expired subscriptions
- WHEN the cron job runs
- THEN ALL expired subscriptions MUST be processed in a single transaction batch

#### Scenario: Subscription expires while user is on free tier

- GIVEN a user whose subscription expired but never had feature benefits
- WHEN the cron processes that subscription
- THEN the cron MUST still mark the subscription as expired
- AND the change is a no-op on listings (no active features to remove)

### Requirement: Row-Level Security for subscriptions

The `subscription_plans` table MUST be publicly readable. The `subscriptions` table MUST be owner-scoped: users can only read their own subscription rows, and Edge Functions (with service role) can read/write all rows.

#### Scenario: Unauthenticated user reads plans

- GIVEN an unauthenticated user
- WHEN they query `subscription_plans`
- THEN the query MUST succeed (public read enabled)

#### Scenario: User reads another user's subscription

- GIVEN user A is authenticated
- WHEN they query the `subscriptions` table for user B's row
- THEN the query MUST return zero rows
