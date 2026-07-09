# Proposal: MercadoPago Subscriptions

## Intent

Users can browse plans but "Elegir plan" does nothing. Without subscriptions,
featuring is free and unlimited, reducing its value. This change adds MercadoPago
recurring payments so users subscribe to a plan, get priority featuring, and
auto-lose those benefits when the subscription expires.

## Scope

### In Scope
- MercadoPago PreApproval API (credit/debit cards only)
- Subscription creation via Edge Function + `expo-web-browser`
- MP webhook handler for status change notifications
- Subscription lifecycle: activate, cancel, expire, auto-unfeature
- Migration: add `mp_preapproval_id` and `external_reference` to `subscriptions`
- Daily cron for expired subscription cleanup
- Use `listing_priority` in listing queries (currently ignored)
- Fix plans.tsx mock data to match DB seed (Basico/Profesional/Premium)

### Out of Scope
- Promotions, trials, discount codes
- One-time payments / single-listing featuring
- Admin dashboard, partial refunds, proration
- Payment method management (saved cards)

## Capabilities

### New Capabilities
- `subscription-payment`: MP PreApproval flow — create preapproval, redirect user via web browser, process webhook status changes
- `subscription-management`: plan display, subscription status tracking, cancel flow, cron-based expiration + auto-unfeature
- `listing-priority`: use `listing_priority DESC` in home carousel and explore queries; auto-unfeature on expiry

### Modified Capabilities
None — no existing spec covers subscriptions/plans.

## Approach

1. **Migration**: add `mp_preapproval_id` (text, unique) and `external_reference` (text) to `subscriptions`
2. **Edge Functions**: `create-subscription` (calls `POST /v1/preapproval`, returns `init_point`) and `mp-webhook` (validates MP signature, idempotent upsert, unfeatures listings on cancellation)
3. **Client**: `plans.tsx` — "Elegir plan" calls Edge Function → opens `init_point` via `expo-web-browser` → polls subscription status on return
4. **Profile**: show active plan + expiration + cancel button
5. **Priority queries**: home carousel, explore, `useListingsInfinite` — ORDER BY `listing_priority DESC, created_at DESC`
6. **Cron**: daily pg_cron job checks `subscriptions.expires_at`, sets `subscription_type = null` and `is_featured = false` for expired users

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Add columns, cron function |
| `supabase/functions/create-subscription/` | New | Edge Function |
| `supabase/functions/mp-webhook/` | New | Webhook handler |
| `app/plans.tsx` | Modified | Wire action button, remove stale mocks |
| `app/(tabs)/profile.tsx` | Modified | Show plan + cancel |
| `app/(tabs)/index.tsx` | Modified | `listing_priority` ordering |
| `hooks/useListings.ts` | Modified | Priority sort in queries |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MP webhook missed/delayed | Medium | Daily cron safety net; manual retry option |
| User closes browser before redirect | Medium | Polling on return; idempotent endpoint |
| Double webhook processing | Low | Idempotency key on `mp_preapproval_id` |
| API credentials leak | Low | Use SUPABASE_SERVICE_ROLE_KEY; MP tokens as secrets |

## Rollback Plan

Disable both Edge Functions → revert migration (drop columns, drop cron) → revert query ordering → cancel active preapprovals via MP API manually.

## Dependencies

- MercadoPago account with production API credentials (access token)
- `expo-web-browser` (included in Expo SDK 54)
- `pg_cron` extension enabled in Supabase project

## Success Criteria

- [ ] User selects a plan, authorizes via MP, subscription activates within 60s
- [ ] Profile shows correct plan name + expiration date for active subscriptions
- [ ] Daily cron unfeatures all listings for expired subscriptions
- [ ] `listing_priority` controls sort order in home carousel and explore
- [ ] User can cancel subscription from profile
- [ ] plans.tsx data matches DB seed (no stale mock fallback)
