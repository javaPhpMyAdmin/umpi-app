# Proposal: Destacar Aviso Toggle

## Intent

Users with active subscription plans cannot feature individual listings because no UI exposes this capability. The toggle must be in the publish screen only, enforcing plan slot limits server-side. Additionally, `mp-webhook` never sets `featured_until`, causing featured listings to never expire properly (the cron `expire_featured_listings()` depends on it).

## Scope

### In Scope
- "Destacar" toggle on publish screen (create mode only)
- Banner prompting "Ver planes" when user has no active plan
- `feature_listing` SECURITY DEFINER RPC: validates plan, enforces `max_featured`, sets `featured_until`, `listing_priority`, `is_featured`
- `mp-webhook` fix: set `featured_until = now() + featured_duration_days` on authorized webhook
- In-app notification when a listing is successfully featured

### Out of Scope
- Edit screen toggle (explicit user decision)
- Profile/dashboard showing remaining featured slots
- Admin panel for managing featured listings

## Capabilities

### New Capabilities
- `listing-feature-toggle`: Client-side toggle UI on publish screen, plan-aware banner, RPC integration after listing insert

### Modified Capabilities
- `listing-priority`: New requirement for user-initiated feature via RPC (currently only webhook-driven)
- `subscription-payment`: Webhook fix to set `featured_until` on authorized events

## Approach

1. Create `feature_listing(p_listing_id)` SECURITY DEFINER RPC that: verifies caller owns listing, fetches active plan from `subscriptions` + `subscription_plans`, counts current featured listings (`is_featured = true AND featured_until > now()`), validates count < `max_featured`, then sets `is_featured = true`, `listing_priority = plan.listing_priority`, `featured_until = now() + interval '1 day' * plan.featured_duration_days`.
2. Publish screen: after successful listing insert, if toggle is ON, call RPC. If toggle OFF and listing is featured, call a corresponding `unfeature_listing` RPC (or handle in the same RPC with a flag).
3. Publish screen: if no active subscription, show banner with "Ver planes" button linking to `/plans`. Toggle is disabled/hidden.
4. `mp-webhook` Edge Function: on `authorized` event, add `featured_until = now() + interval '1 day' * plan.featured_duration_days` to the listing update.
5. Notification: after successful feature, show toast "Tu aviso fue destacado correctamente".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Migration for `feature_listing` RPC |
| `app/(tabs)/publish.tsx` | Modified | Add toggle, banner, post-insert RPC call |
| `supabase/functions/mp-webhook/` | Modified | Add `featured_until` assignment |
| `contexts/AuthContext.tsx` | Modified | Expose subscription plan data for toggle state |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Concurrent inserts exceed max_featured | Low | RPC uses `SELECT ... FOR UPDATE` or atomic count+insert inside transaction |
| Plan expires between toggle and form submit | Low | RPC re-validates plan at call time; stale toggle is a no-op |
| Webhook fix doesn't retroactively fix existing featured listings | Medium | One-time migration script to backfill `featured_until` for currently featured listings without it |

## Rollback Plan

- **RPC**: `DROP FUNCTION feature_listing(uuid)` — clients show error toast, feature toggle gracefully degrades
- **Webhook**: revert Edge Function deploy; old behavior (no `featured_until`) resumes, cron continues working for backfilled rows
- **UI toggle**: revert publish screen changes; toggle simply stops appearing

## Dependencies

- Active `subscription_plans` table with `max_featured` and `featured_duration_days` columns (already exists)
- `prevent_direct_featured_write` trigger must be bypassed by the SECURITY DEFINER RPC (by design)

## Success Criteria

- [ ] User with active plan can toggle "Destacar" on publish and listing becomes featured with correct `featured_until`
- [ ] User without plan sees banner, not toggle
- [ ] Estándar plan allows max 1 featured listing; Premium allows max 10
- [ ] `mp-webhook` sets `featured_until` on authorized events
- [ ] `expire_featured_listings()` cron correctly expires listings set by the new RPC
- [ ] Backfill migration runs for any existing featured listings missing `featured_until`
