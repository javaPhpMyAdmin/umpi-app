# Proposal: Featured Infinite Scroll

## Intent

The home screen's featured section is capped at 6 items, fetched from a limited 20-item query. Users who tap "Ver todos" land on the Explore tab — a generic listing screen — not a dedicated featured view. This creates a visibility gap: paid subscribers' featured listings are underrepresented, and there's no way to browse all featured listings with infinite scroll.

## Scope

### In Scope
- New standalone route `app/featured.tsx` — dedicated featured listings screen with infinite scroll
- Empty state with message + "Ver planes" CTA navigating to `/plans`
- Change "Ver todos" navigation target from `/explore` to `/featured` on home screen
- Reuse existing `useListingsInfinite` hook with `filter: 'featured'`

### Out of Scope
- Prefetching / cache warming from home screen (future enhancement)
- Filtering by category or sorting within the featured screen
- `featured_until` expiry enforcement (existing gap, not introduced by this change)
- Changes to the home carousel section (stays as-is)

## Capabilities

### New Capabilities
- `featured-listings`: Dedicated infinite-scroll screen for browsing all featured/priority listings with empty-state CTA

### Modified Capabilities
- `listing-priority`: Home screen "Ver todos" navigation changes from explore to featured screen (requirement impact only — spec delta needed)

## Approach

Reuse `useListingsInfinite` hook directly, passing `{ filter: 'featured', sortBy: 'priority' }` with hardcoded params. The screen is modeled after `app/(tabs)/explore.tsx` but stripped of search, category filter, and sort UI. `FlatList` with `onEndReached` for infinite scroll, `ListingCard variant="compact"` in 2-column grid. Standalone route auto-registered by Expo Router — no layout changes needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/featured.tsx` | New | Dedicated featured screen with FlatList infinite scroll |
| `app/(tabs)/index.tsx` | Modified | Line 182: nav target `/explore` → `/featured` |
| `hooks/useListingsInfinite.ts` | None | Already supports `filter: 'featured'` — no changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Few featured listings → screen feels empty | Low | Empty state with "Ver planes" CTA handles this |
| Query key cache collision with explore screen | Low | Different filter params produce different keys naturally |

## Rollback Plan

1. Revert `app/(tabs)/index.tsx` line 182: change `/featured` back to `/explore`
2. Delete `app/featured.tsx`
3. No database or migration changes to revert

## Dependencies

None. All infrastructure (hook, index, query client) already exists.

## Success Criteria

- [ ] "Ver todos" on home screen navigates to `/featured`
- [ ] Featured screen loads 20 listings per page with infinite scroll
- [ ] Empty state displays when no featured listings exist, with working "Ver planes" CTA
- [ ] Screen renders without tab bar (standalone route)
- [ ] No TypeScript errors (`npm run typecheck` passes)
