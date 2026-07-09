# Subscription Payment Specification

## Purpose

Allow users to subscribe to a featured listing plan through MercadoPago recurring payments (PreApproval API). Cover the full payment flow: preapproval creation, browser redirect for user authorization, return-url handling, and webhook-based status change processing.

## Requirements

### Requirement: Initiate PreApproval from plan selection

The system MUST call the `create-subscription` Edge Function when the user taps "Elegir plan" on the plans screen. The Edge Function MUST create a MercadoPago PreApproval and return an `init_point` URL.

#### Scenario: User selects a plan and authorizes payment

- GIVEN the authenticated user has no active subscription
- AND the user selects a plan on the plans screen
- WHEN the user taps "Elegir plan"
- THEN the system MUST call `create-subscription` with `plan_id` and `user_id`
- AND receive an `init_point` URL in the response
- AND open that URL via `expo-web-browser` for MP authorization

#### Scenario: User already has an active subscription

- GIVEN the authenticated user already has an active subscription
- WHEN the user taps "Elegir plan" on any plan card
- THEN the system MUST show an error toast "Ya tienes un plan activo"
- AND MUST NOT call the Edge Function

#### Scenario: Edge Function returns error

- GIVEN the user selects a plan and taps "Elegir plan"
- WHEN the `create-subscription` Edge Function returns an error
- THEN the system MUST show an error toast "Error al crear la suscripcion"
- AND MUST NOT open the browser

### Requirement: Handle return from MercadoPago

After the user authorizes or cancels in the MP browser, the system MUST process the result from the back URL (success, pending, or failure).

#### Scenario: Successful authorization

- GIVEN the user authorized the preapproval in the MP browser
- WHEN `expo-web-browser` returns with a success status
- THEN the system MUST poll the subscription status
- AND show a success toast "Suscripcion activada"
- AND navigate to the profile screen showing the active plan

#### Scenario: User cancels in MP browser

- GIVEN the MP authorization page is open in `expo-web-browser`
- WHEN the user closes the browser or cancels the authorization
- THEN the system MUST show "Pago cancelado"
- AND NOT create any subscription record

#### Scenario: Payment pending

- GIVEN the user completed authorization but payment is pending
- WHEN the browser returns with a pending status
- THEN the system MUST show "Pago pendiente de aprobacion"
- AND the subscription MUST show as pending in the profile

### Requirement: Process incoming webhook events idempotently

The `mp-webhook` Edge Function MUST handle status changes from MercadoPago PreApproval webhooks: `authorized`, `cancelled`, `paused`, and `expired`. Processing MUST be idempotent — the same event MUST NOT create duplicate records.

#### Scenario: Webhook for authorized preapproval

- GIVEN MercadoPago sends an `authorized` webhook event
- WHEN `mp-webhook` receives the event
- THEN the system MUST upsert the subscription row with `mp_preapproval_id` and `external_reference`
- AND set `subscription_type` to the corresponding plan level
- AND set `is_featured = true` on all the user's listings
- AND return HTTP 200

#### Scenario: Duplicate webhook event

- GIVEN MercadoPago sends the same `authorized` event twice
- WHEN `mp-webhook` receives the second event
- THEN the system MUST detect the duplicate via `mp_preapproval_id` uniqueness
- AND return HTTP 200 without modifying any rows

#### Scenario: Webhook for cancelled preapproval

- GIVEN an active subscription exists
- WHEN `mp-webhook` receives a `cancelled` event
- THEN the system MUST set `subscription_type = null` and `is_featured = false` on all the user's listings
- AND set `listing_priority = 0` on all the user's featured listings

#### Scenario: Invalid webhook signature

- GIVEN a request arrives at `mp-webhook`
- WHEN the MercadoPago signature validation fails
- THEN the system MUST return HTTP 401
- AND MUST NOT process the event

### Requirement: Idempotent subscription creation

The same `external_reference` MUST NOT result in duplicate subscription rows or duplicate charges.

#### Scenario: Same external_reference sent twice

- GIVEN the `create-subscription` endpoint receives a request with an `external_reference` that already exists in the `subscriptions` table
- WHEN the Edge Function processes the request
- THEN the system MUST return the existing preapproval data
- AND MUST NOT create a new PreApproval in MP
