# Design: MercadoPago Subscriptions

## Technical Approach

Two Edge Functions + `pg_cron` + client-side `expo-web-browser` flow. `create-subscription` calls MP PreApproval API and returns `init_point`; the app opens it in a browser, and on return polls subscription status. `mp-webhook` handles status callbacks idempotently. Daily cron catches expired subscriptions. `listing_priority` sort is applied server-side in Supabase queries.

## Architecture Decisions

### Decision: MP API integration

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| Native `fetch` to `https://api.mercadopago.com/preapproval` | `mercadopago` npm SDK | SDK is 200KB+ and designed for Node.js — bundling into Edge Function adds cold start overhead. The PreApproval API is two endpoints, both simple POST/GET. `fetch` is available natively in Deno Edge Functions. |

### Decision: Cron mechanism

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| `pg_cron` scheduled function | Edge Function scheduled webhook | Operation is pure SQL (UPDATE subscriptions + listings + profiles). `pg_cron` runs inside Postgres with zero network latency, atomic transaction, no cold start. Supabase ships `pg_cron` pre-installed. |

### Decision: Post-browser-return flow

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| Poll subscription status via Supabase query | Deep link from MP back_url | Deep links need custom URL scheme setup and are fragile on Android. Polling is simpler: after `expo-web-browser` closes, retry `supabase.from('subscriptions').select().eq('user_id', uid)` every 3s for 15s. The webhook typically fires in <5s. |

### Decision: Webhook idempotency

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| `mp_preapproval_id` UNIQUE constraint + `ON CONFLICT DO NOTHING` | External idempotency key | The column is naturally unique per PreApproval. Using a DB constraint guarantees no duplicate rows regardless of concurrency. Simpler than generating/managing external keys. |

### Decision: Listing feature column security

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| DB trigger rejecting non-service-role writes to `is_featured` / `listing_priority` | RLS policy on UPDATE | Trigger is unavoidable — RLS WITH CHECK applies to the final row state (can't distinguish "user set it" from "it was already set"). Trigger checks `auth.uid() IS NOT NULL` (service_role calls have no auth context) and rejects if feature columns changed. Edge Functions and cron bypass via service_role. |

## Data Flow

```
┌──────────────┐     POST /create-subscription     ┌──────────────────┐
│  plans.tsx   │ ──────────────────────────────────→│  Edge Function   │
│  (Elegir)    │←── { init_point, external_ref } ──│ create-subscription│
└──────┬───────┘                                    └────────┬─────────┘
       │ openBrowser(init_point)                              │ POST /v1/preapproval
       ↓                                                      ↓
┌──────────────┐                                    ┌──────────────────┐
│ MP Browser   │──── user authorizes ──────────────→│  MercadoPago API │
│ (WebBrowser) │←── redirect to back_url ───────────│  /preapproval    │
└──────┬───────┘                                    └──────────────────┘
       │ browser closes                                    │
       │ poll subscription 3s×5                            │ Webhook POST /mp-webhook
       ↓                                                    ↓
┌──────────────┐                                    ┌──────────────────┐
│  Supabase    │←── upsert subscription ────────────│  Edge Function   │
│  (poll)      │←── UPDATE listings is_featured ───│ mp-webhook       │
└──────────────┘                                    └──────────────────┘

                    ┌─────────────────────┐
                    │  pg_cron (daily 3AM)│
                    │  expire_subscribers()│
                    └─────────┬───────────┘
                              │ UPDATE subscriptions SET status='expired'
                              │ UPDATE listings SET is_featured=false, listing_priority=0
                              │ UPDATE profiles SET subscription_type='none'
                              ↓
                    ┌─────────────────────┐
                    │    Supabase DB       │
                    └─────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260709000001_add_mp_fields.sql` | Create | Add `mp_preapproval_id` (text UNIQUE), `external_reference` (text) to `subscriptions`; add trigger for feature-column protection; create `expire_subscriptions()` function + cron schedule |
| `supabase/functions/create-subscription/index.ts` | Create | Edge Function: validates JWT, POST to `https://api.mercadopago.com/preapproval` with plan data + `back_url` + `external_reference`, returns `init_point` |
| `supabase/functions/create-subscription/.env.example` | Create | Document required env vars: `MP_ACCESS_TOKEN` |
| `supabase/functions/mp-webhook/index.ts` | Create | Edge Function: validates MP `X-Signature`, upserts subscription by `mp_preapproval_id`, unfeatures/features listings on status change |
| `supabase/functions/mp-webhook/.env.example` | Create | Document required env vars: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| `app/plans.tsx` | **Modify** | Remove mock `defaultPlans` (lines 23–27); wire "Elegir plan" to call Edge Function → `openAuthSessionAsync` → poll → navigate; show error toasts; check active subscription guard |
| `app/(tabs)/profile.tsx` | **Modify** | Update `getSubscriptionColor`/`getSubscriptionLabel` to use DB slugs: `basico`→`Básico`, `profesional`→`Profesional`, `premium`→`Premium`; add cancel subscription button + confirmation dialog + MP API call; show expiration date |
| `app/(tabs)/index.tsx` | **Modify** | Filter `featured` by `listing_priority > 0` and sort by `listing_priority DESC, created_at DESC` — currently uses `is_featured` only |
| `hooks/useListingsInfinite.ts` | **Modify** | Add `order('listing_priority', { ascending: false }).order('created_at', { ascending: false })` as default sort; keep existing sort by `sortBy` as secondary |
| `hooks/useListings.ts` | **Modify** | Add `order('listing_priority', { ascending: false }).order('created_at', { ascending: false })` to `useListings` query |
| `types/index.ts` | **Modify** | Add `mp_preapproval_id` and `external_reference` optional fields to the Subscription type (if one exists) — no change needed if consuming via raw DB types |
| `app/(tabs)/explore.tsx` | **Modify** | Ensure the `filter: 'featured'` option uses `listing_priority` ordering |

## Interfaces / Contracts

### Edge Function: `create-subscription`

```
POST /functions/v1/create-subscription
Headers: { Authorization: Bearer <supabase_anon_key> }
Body: { plan_id: string }

200 { init_point: string, external_reference: string }
400 { error: "User already has active subscription" }
500 { error: string }
```

### Edge Function: `mp-webhook`

```
POST /functions/v1/mp-webhook
Headers: { X-Signature: <mp_signature> }
Body: { action: "preapproval.updated", data: { id: "<mp_preapproval_id>" } }

200 { ok: true }
401 { error: "Invalid signature" }
```

### PreApproval POST body (to MP)

```json
{
  "back_url": { "success": "umpi://subscription/success", "pending": "umpi://subscription/pending", "failure": "umpi://subscription/failure" },
  "payer_email": "<user_email>",
  "reason": "Umpi - <plan_name>",
  "external_reference": "sub_<user_id>_<plan_id>",
  "auto_recurring": { "frequency": 1, "frequency_type": "months", "transaction_amount": <price>, "currency_id": "ARS" }
}
```

## Migration / Rollout

1. **Deploy migration**: add columns + trigger + cron function + schedule; runs idempotently
2. **Set MP secrets**: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` in Supabase Edge Function secrets
3. **Deploy Edge Functions**: `create-subscription` then `mp-webhook` (order matters for testing)
4. **Configure MP Webhook**: in MP dashboard, point `preapproval` events to `<project>.functions.supabase.co/mp-webhook`
5. **Deploy app changes**: `plans.tsx`, `profile.tsx`, listing queries — in one PR
6. **Rollback**: disable Edge Functions → revert migration (DROP COLUMN, DROP TRIGGER, DROP FUNCTION, DROP EXTENSION IF UNUSED) → revert query ordering → cancel active preapprovals manually

## Open Questions

- [ ] Should `external_reference` pattern be `sub_{user_id}` or `sub_{user_id}_{plan_id}`? Former is simpler for lookup; latter allows plan change tracking later.
- [ ] MP PreApproval test credentials — are sandbox credentials available for development?
- [ ] Does the existing `listings_update_own` RLS policy need adjustment or does the trigger approach fully cover the security requirement?
- [ ] What should the back_url success URL scheme be on native? (`umpi://subscription/success` or handle via polling only and leave back_url pointing to a no-op page?)
