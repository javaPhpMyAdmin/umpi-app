# Tasks: Destacar Aviso Toggle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Database (migrations)

- [x] 1.1 Create `supabase/migrations/20260714000001_feature_listing_rpc.sql`: `feature_listing(uuid)` SECURITY DEFINER RPC — validates ownership, active plan, slot limit; sets `is_featured`, `listing_priority`, `featured_until` with `SET LOCAL app.allow_featured_write = 'true'` GUC bypass. Also update `prevent_direct_featured_write` trigger to check `current_setting('app.allow_featured_write', true)` before raising.
- [x] 1.2 Create `supabase/migrations/20260714000002_backfill_featured_until.sql`: One-time UPDATE for featured listings with `featured_until IS NULL` — join `subscriptions` + `subscription_plans`, set `featured_until = created_at + interval '1 day' * featured_duration_days`.

## Phase 2: Backend (webhook fix)

- [x] 2.1 Modify `supabase/functions/mp-webhook/index.ts`: Expand `subscription_plans` select to include `featured_duration_days`. In the `authorized` handler, add `featured_until` to the listings UPDATE using `now() + interval '1 day' * featured_duration_days`.

## Phase 3: Frontend (publish screen)

- [x] 3.1 Modify `types/index.ts`: Add `featured_until: string | null` to `Listing` interface if missing.
- [x] 3.2 Modify `app/(tabs)/publish.tsx`: Destructure `profile` from `useAuth()`. Add `hasActivePlan` derived state (`subscription_type !== 'none' && subscription_expires_at > now()`). Add `featureToggle` state (boolean, default `false`).
- [x] 3.3 In publish.tsx: After Fotos section, render "Sin plan" banner with "Ver planes" button → `router.push('/plans')` when `!hasActivePlan`. When `hasActivePlan`, render `Switch` with label "Destacar aviso".
- [x] 3.4 In publish.tsx `handlePublish`: After successful listing INSERT, if `featureToggle` is ON, call `supabase.rpc('feature_listing', { p_listing_id })`. On RPC error: show success for listing + separate error toast for feature. On RPC success: show "Tu aviso fue destacado correctamente". Feature failure is non-blocking.

## Phase 4: Verification

- [x] 4.1 Test `feature_listing` RPC via Supabase SQL Editor: verify ownership check rejects wrong user, missing plan raises, slot limit raises, success returns correct JSON.
- [x] 4.2 Test trigger GUC bypass: direct UPDATE by authenticated user still blocked; RPC UPDATE succeeds.
- [x] 4.3 Manual E2E: publish screen with no plan → banner visible, toggle hidden. Publish with plan + toggle ON → listing created, `featured_until` set correctly.
