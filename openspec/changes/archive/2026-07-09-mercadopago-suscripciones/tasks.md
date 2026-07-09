# Tasks: MercadoPago Subscriptions

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~460-490 |
| Budget | 800 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation — Migration & Types

- [x] 1.1 Create `supabase/migrations/20260709000001_add_mp_fields.sql` — add `mp_preapproval_id` (text UNIQUE) and `external_reference` (text) to `subscriptions`
- [x] 1.2 Add DB trigger to reject client-side writes to `is_featured` / `listing_priority` (check `auth.uid() IS NOT NULL`)
- [x] 1.3 Create `expire_subscriptions()` PL/pgSQL function — UPDATE subscriptions SET status='expired', unfeature all user's listings
- [x] 1.4 Add pg_cron schedule running `expire_subscriptions()` daily at 3AM
- [x] 1.5 Add RLS policy on `subscriptions`: owner-scoped reads, service-role writes
- [x] 1.6 Add `Subscription` interface in `types/index.ts` with `mp_preapproval_id`, `external_reference`, `status`, `expires_at`

## Phase 2: Edge Functions

- [x] 2.1 Create `supabase/functions/create-subscription/index.ts` — validate JWT, check no active sub exists, POST to MP `/preapproval`, return `init_point` + `external_reference`
- [x] 2.2 Create `supabase/functions/create-subscription/.env.example` — document `MP_ACCESS_TOKEN`
- [x] 2.3 Create `supabase/functions/mp-webhook/index.ts` — validate MP `X-Signature`, upsert subscription by `mp_preapproval_id`, feature/unfeature listings on `authorized`/`cancelled`/`expired` status
- [x] 2.4 Create `supabase/functions/mp-webhook/.env.example` — document `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`

## Phase 3: Mobile — Payment Flow

- [x] 3.1 `app/plans.tsx` — remove mock `defaultPlans`, fetch from `subscription_plans` table ordered by `price ASC`
- [x] 3.2 Wire "Elegir plan" button: guard check for active subscription → call `create-subscription` EF → `openAuthSessionAsync(init_point)` → poll subscription (3s × 5 attempts) → navigate to profile
- [x] 3.3 Add error toasts for edge cases: active sub guard, EF error, browser cancel, pending status
- [x] 3.4 Handle empty/error state for plans screen (no fallback to stale mock data)

## Phase 4: Mobile — Subscription Management

- [x] 4.1 `app/(tabs)/profile.tsx` — update `getSubscriptionColor`/`getSubscriptionLabel` for slugs: `basico`→Básico, `profesional`→Profesional, `premium`→Premium
- [x] 4.2 Show `subscription_expires_at` formatted as "dd de MMMM de yyyy" + warning within 7 days
- [x] 4.3 Add "Cancelar suscripción" button with confirmation dialog + `cancel-subscription` Edge Function → MP API cancel + local DB update + success/error toasts
- [x] 4.4 Hide cancel button when no active subscription; show "Sin plan" state; show "Pendiente" for pending payments

## Phase 5: Listing Priority in Queries

- [x] 5.1 `app/(tabs)/index.tsx` — filter featured by `listing_priority > 0`, sort `listing_priority DESC, created_at DESC`
- [x] 5.2 `app/(tabs)/explore.tsx` — ensure `filter: 'featured'` uses `listing_priority` ordering (covered by shared hook default in 5.3)
- [x] 5.3 `hooks/useListingsInfinite.ts` — add `order('listing_priority', { ascending: false }).order('created_at', { ascending: false })` as default sort
- [x] 5.4 `hooks/useListings.ts` — same `listing_priority DESC, created_at DESC` sort
