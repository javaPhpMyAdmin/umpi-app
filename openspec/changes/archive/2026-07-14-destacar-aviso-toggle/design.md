# Design: Destacar Aviso Toggle

## Technical Approach

Add a "Destacar aviso" toggle on the publish screen that calls a `feature_listing` SECURITY DEFINER RPC after listing creation. The RPC validates ownership, active subscription, and slot limits atomically. Fix `mp-webhook` to set `featured_until` on authorized events. One-time backfill for existing featured listings missing `featured_until`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Server-side validation | SECURITY DEFINER RPC | Edge Function call from client | Single round-trip, atomic transaction, no Edge Function cold start. Follows existing pattern (`create_conversation_with_message` RPC). |
| Toggle timing | Post-insert only (create mode) | Pre-insert or edit mode | Proposal scope. Avoids double-RPC on edit. Listing must exist before featuring. |
| Error display | Toast (via `showError`) | Inline error below toggle | Consistent with existing publish screen pattern — all errors use `showError`. |
| Trigger bypass | GUC variable (`SET LOCAL`) | Disable trigger, change trigger logic | Least invasive. Trigger still protects all other writes; only the RPC opts in via session variable. |
| Plan detection | `profile.subscription_type !== 'none' AND subscription_expires_at > now()` | Separate RPC call | Profile is already loaded in AuthContext. Zero extra queries. |

## Trigger Bypass — Critical Detail

The `prevent_direct_featured_write` trigger (migration `20260713000005`) blocks ALL authenticated users from modifying `is_featured`, `listing_priority`, or `featured_until` — **including SECURITY DEFINER functions**, because `auth.uid()` still returns the JWT caller's UID inside trigger context.

**Solution**: Modify the trigger to respect a GUC variable:

```sql
-- Updated trigger function
IF auth.uid() IS NOT NULL
   AND current_setting('app.allow_featured_write', true) != 'true'
THEN
  -- existing check...
END IF;
```

The `feature_listing` RPC sets `SET LOCAL app.allow_featured_write = 'true'` before the UPDATE. This keeps the trigger effective for all other paths.

## Data Flow

```
Publish Screen
  │
  ├─ [Toggle ON] ──→ After INSERT success
  │                      │
  │                      ▼
  │               feature_listing(listing_id)
  │                 │
  │                 ├─ Verify: user_id = auth.uid()
  │                 ├─ Verify: active subscription (JOIN subscriptions + subscription_plans)
  │                 ├─ Count: active featured < max_featured
  │                 └─ UPDATE: is_featured, listing_priority, featured_until
  │                      │
  │                      ▼
  │                 Toast: "Tu aviso fue destacado correctamente"
  │
  └─ [No plan] ──→ Banner: "Suscribite a un plan..." → /plans
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260714000001_feature_listing_rpc.sql` | Create | `feature_listing` RPC + trigger GUC bypass |
| `supabase/migrations/20260714000002_backfill_featured_until.sql` | Create | One-time backfill: `featured_until = created_at + interval '1 day' * plan.featured_duration_days` for featured listings where `featured_until IS NULL` |
| `app/(tabs)/publish.tsx` | Modify | Destructure `profile`, add `Switch`, banner, post-insert RPC call |
| `supabase/functions/mp-webhook/index.ts` | Modify | Add `featured_until` to authorized event listing update |
| `types/index.ts` | Modify | Add `featured_until: string \| null` to `Listing` interface |

## RPC Contract

```sql
CREATE OR REPLACE FUNCTION feature_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
```

**Returns** on success: `{ "ok": true, "listing_priority": 1, "featured_until": "2026-07-21T..." }`
**Returns** on error: raises EXCEPTION (client catches via `error.message`)

**Logic** (single transaction):
1. `auth.uid()` IS NOT NULL — else raise
2. SELECT listing WHERE `id = p_listing_id AND user_id = auth.uid()` — else raise "No sos el dueño"
3. JOIN `subscriptions` + `subscription_plans` WHERE `user_id = auth.uid() AND status = 'active' AND expires_at > now()` — else raise "No tenés un plan activo"
4. COUNT active featured: `WHERE user_id = auth.uid() AND is_featured = true AND (featured_until IS NULL OR featured_until > now())`
5. If count >= `plan.max_featured` — raise "Llegaste al límite de avisos destacados"
6. `SET LOCAL app.allow_featured_write = 'true'`
7. `UPDATE listings SET is_featured = true, listing_priority = plan.listing_priority, featured_until = now() + interval '1 day' * plan.featured_duration_days WHERE id = p_listing_id`
8. Return success JSON

## Publish Screen Changes

**New state**: `const [featureToggle, setFeatureToggle] = useState(false)`

**Destructure profile**: `const { user, profile } = useAuth()` (currently only `user`)

**Active plan check**:
```typescript
const hasActivePlan =
  profile?.subscription_type !== 'none' &&
  profile?.subscription_expires_at != null &&
  new Date(profile.subscription_expires_at) > new Date();
```

**UI placement**: After the Fotos section, before the Publish button:
- If `!hasActivePlan`: render banner with "Ver planes" button → `router.push('/plans')`. Toggle hidden.
- If `hasActivePlan`: render `Switch` with label "Destacar aviso". Toggle visible.

**Post-insert flow** (inside `handlePublish`, new listing branch):
```typescript
const { data: listingData, error } = await supabase.from('listings').insert({...}).select('id').single();
if (!error && featureToggle) {
  const { error: rpcError } = await supabase.rpc('feature_listing', { p_listing_id: listingData.id });
  if (rpcError) {
    showSuccess('Publicación creada');
    showError('No se pudo destacar', rpcError.message);
  } else {
    showSuccess('Tu aviso fue destacado correctamente');
  }
} else if (!error) {
  showSuccess('Exito', 'Publicacion creada');
}
```

Key: the listing is published regardless of RPC outcome. Feature failure is non-blocking.

## Webhook Fix

In `mp-webhook/index.ts`, the `authorized` handler currently does:
```typescript
await supabaseAdmin
  .from('listings')
  .update({ is_featured: true, listing_priority: priority })
  .eq('user_id', userId)
```

Change to also set `featured_until`. The plan's `featured_duration_days` is already fetched (line 128-131) but the query only selects `slug, listing_priority`. Expand the select:

```typescript
const { data: plan } = await supabaseAdmin
  .from('subscription_plans')
  .select('slug, listing_priority, featured_duration_days')
  .eq('id', planId)
  .single()
```

Then update the listings query:
```typescript
const durationDays = plan?.featured_duration_days ?? 3
await supabaseAdmin
  .from('listings')
  .update({
    is_featured: true,
    listing_priority: priority,
    featured_until: new Date(Date.now() + durationDays * 86400000).toISOString(),
  })
  .eq('user_id', userId)
```

## Backfill Migration

```sql
UPDATE listings l
SET featured_until = l.created_at + (sp.featured_duration_days || ' days')::interval
FROM subscriptions s
JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE l.user_id = s.user_id
  AND l.is_featured = true
  AND l.featured_until IS NULL
  AND s.status = 'active';
```

Listings from cancelled/expired subscriptions without `featured_until` stay as-is (the daily cron will not expire them since `featured_until IS NULL`, but they'll be cleaned up on next subscription event or manual admin action).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| SQL | RPC validates ownership, plan, slot limit | Manual SQL tests in Supabase Dashboard |
| SQL | Trigger allows RPC but blocks direct UPDATE | Verify both paths in SQL Editor |
| UI | Toggle visible only with active plan | Manual: publish screen with/without plan |
| UI | Feature success/failure toasts | Manual: toggle ON, publish, check toast |
| Integration | Webhook sets featured_until | MP sandbox → verify listing row |

## Migration / Rollout

1. Deploy migration `000001` (RPC + trigger update)
2. Deploy migration `000002` (backfill)
3. Deploy `mp-webhook` edge function update
4. Deploy app update with toggle UI

Rollback: `DROP FUNCTION feature_listing(uuid)`, revert trigger, revert webhook.

## Open Questions

None — all decisions resolved.
