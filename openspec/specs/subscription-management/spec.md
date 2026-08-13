# Subscription Management Specification

## Purpose

Let users view the available subscription plans and read their own subscription status. The mobile app does NOT sell subscriptions: plans are purchased exclusively on the web (umpi.com.ar). The app only reads plan availability and the user's active plan from the shared Supabase database.

## Requirements

### Requirement: Display subscription plans from database

The plans screen MUST fetch available plans from the `subscription_plans` table. Plans are read-only: the user cannot purchase, cancel, or manage them from the app.

#### Scenario: Plans load from database

- GIVEN the user navigates to the plans screen
- WHEN the screen renders
- THEN it MUST query `subscription_plans` ordered by `price ASC`
- AND display each plan's name, price (formatted in ARS), and feature list
- AND NOT fall back to hardcoded mock data if the table is empty — show empty state instead

#### Scenario: Database query fails

- GIVEN the `subscription_plans` query fails
- WHEN the plans screen renders
- THEN the system MUST show an error state with a "Reintentar" button
- AND MUST NOT show stale hardcoded plan data

#### Scenario: User taps a plan card

- GIVEN the plans screen is rendering plan cards
- WHEN the user taps any plan card
- THEN the system MUST NOT initiate any payment or navigation to an external checkout
- AND the plan cards MUST be non-interactive (no purchase action)

#### Scenario: Plans screen shows web-only purchase notice

- GIVEN the plans screen is rendering
- THEN the screen MUST show a plain-text notice below the plan cards stating that subscriptions are purchased through the website umpi.com.ar
- AND the notice MUST NOT contain a link, button, or any navigable element

### Requirement: Read active subscription in profile

The profile screen MUST display the user's current plan name, subscription status, and expiration date when they have an active subscription, read directly from the shared database via the user profile.

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

#### Scenario: User without active plan

- GIVEN the authenticated user has no subscription row or `subscription_type` is null
- WHEN the user views the profile screen
- THEN the profile MUST show "Sin plan" or "Sin suscripcion activa"

### Requirement: No subscription management actions in the app

The app MUST NOT offer any action to create, verify, sync, or cancel a subscription. Subscription lifecycle (purchase, renewal, cancellation) is handled exclusively by the web application and its server-side functions.

#### Scenario: Profile screen has no subscription actions

- GIVEN the profile screen renders
- THEN it MUST NOT show "Verificar suscripcion", "Cancelar suscripcion", or any button that invokes a subscription Edge Function
- AND the app MUST NOT call `create-subscription`, `cancel-subscription`, `sync-subscription`, or `subscription-result` Edge Functions
- AND the app MUST NOT open any MercadoPago checkout URL

#### Scenario: Subscription changes detected on next profile fetch

- GIVEN the user purchased or cancelled a plan on the web
- WHEN the app refreshes the user profile
- THEN the updated subscription state MUST be reflected in the profile screen without any manual sync action
