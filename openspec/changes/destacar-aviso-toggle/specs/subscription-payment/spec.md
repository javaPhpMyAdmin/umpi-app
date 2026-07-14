# Delta for Subscription Payment

## MODIFIED Requirements

### Requirement: Process incoming webhook events idempotently

The `mp-webhook` Edge Function MUST handle status changes from MercadoPago PreApproval webhooks: `authorized`, `cancelled`, `paused`, and `expired`. Processing MUST be idempotent — the same event MUST NOT create duplicate records. On `authorized` events, the webhook MUST compute and set `featured_until = now() + interval '1 day' * plan.featured_duration_days` for all featured listings.
(Previously: `authorized` events set `is_featured = true` but never assigned `featured_until`, causing featured listings to never expire.)

#### Scenario: Webhook for authorized preapproval

- GIVEN MercadoPago sends an `authorized` webhook event
- WHEN `mp-webhook` receives the event
- THEN the system MUST upsert the subscription row with `mp_preapproval_id` and `external_reference`
- AND set `subscription_type` to the corresponding plan level
- AND set `is_featured = true` on all the user's listings
- AND set `featured_until = now() + interval '1 day' * plan.featured_duration_days` on all the user's listings
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
