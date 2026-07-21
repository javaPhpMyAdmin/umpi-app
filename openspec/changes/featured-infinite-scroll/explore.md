# Exploration: Featured Infinite Scroll

## Current State

### How the Featured Section Works Today

**Data flow:**
1. `useListings()` hook (`hooks/useListings.ts:6-23`) fetches the **last 20 active listings** from Supabase, ordered by `listing_priority DESC` then `created_at DESC`. It returns a flat `Listing[]` array with a 1-minute stale time.
2. Home screen (`app/(tabs)/index.tsx:44-55`) computes `featured` client-side via `useMemo`:
   - Filters for `is_featured === true` AND `listing_priority > 0`
   - Sorts by `listing_priority DESC` then `created_at DESC`
   - **Hard-caps at 6 items** (`.slice(0, 6)`)
3. The featured section renders a horizontal `ScrollView` with `ListingCard variant="featured"` (220px wide cards).
4. **"Ver todos"** (`app/(tabs)/index.tsx:182`) navigates to `/explore` — the Explore tab, NOT a dedicated featured screen.

**Key limitation:** The 20-item fetch limit means if there are more than 20 active listings total, many featured ones may never be fetched. The `.slice(0, 6)` further limits visibility to 6.

### Existing Infinite Scroll Pattern

The Explore screen already uses `useInfiniteQuery`:
- `hooks/useListingsInfinite.ts` — `useListingsInfinite(filters)` hook with offset-based pagination (`PAGE_SIZE = 20`), `keepPreviousData`, and server-side filtering (category, text search, featured/recent filter, sort).
- `app/(tabs)/explore.tsx` — uses `FlatList` with `onEndReached` for infinite scroll, `ListFooterComponent` for loading/end states, `ListHeaderComponent` for stats.

**Critical finding:** The explore hook already supports a `filter: 'featured'` option (line 40-41 in `useListingsInfinite.ts`) that adds `.eq('is_featured', true)` server-side. This means the infinite query infrastructure for featured listings already exists.

### Database Schema

- `listings` table has columns: `is_featured boolean`, `listing_priority integer`, `featured_until timestamptz`
- **Index exists:** `idx_listings_featured ON listings(is_featured, listing_priority DESC)` — covers the featured query pattern perfectly
- Additional index: `idx_listings_status ON listings(status)` — used by the `.eq('status', 'active')` filter
- RLS policy: `listings_select_public` allows SELECT for `status = 'active'` — no auth required for browsing

### Navigation Architecture

- **Root layout** (`app/_layout.tsx`): Stack navigator with `<Stack.Screen name="(tabs)">` as the main group
- **Tab layout** (`app/(tabs)/_layout.tsx`): 5 tabs — Inicio, Explorar, Publicar, Mensajes, Perfil
- **Standalone screens** live at `app/` root level (e.g., `app/plans.tsx`, `app/settings.tsx`, `app/notifications.tsx`) — they're pushed onto the root Stack
- Expo Router file-based routing: a file at `app/featured.tsx` would create route `/featured`

### TanStack Query

- `@tanstack/react-query` v5.101.2 is installed
- `QueryClient` is configured in `_layout.tsx` with `staleTime: 60_000`, `retry: 1`
- `useInfiniteQuery` is already used in `useListingsInfinite.ts`

## Affected Areas

- `hooks/useListingsInfinite.ts` — Already has featured filter support; may need a dedicated hook or can reuse with hardcoded `filter: 'featured'`
- `app/(tabs)/index.tsx` — Change "Ver todos" navigation from `/explore` to `/featured`
- **NEW FILE: `app/featured.tsx`** — Dedicated featured listings screen with infinite scroll
- No changes needed to `_layout.tsx` (standalone screens auto-register in Expo Router)
- No database changes needed (index already exists)

## Approaches

### Approach A: Standalone Route Screen + Dedicated Hook

Create `app/featured.tsx` as a standalone Stack screen with a new `useFeaturedListings()` hook.

- **New file `app/featured.tsx`**: Standalone screen at route `/featured`, modeled after `explore.tsx` but simpler (no search, no category filter, no sort options). Header with back button, `FlatList` with infinite scroll, `ListingCard variant="compact"` in 2-column grid.
- **New file `hooks/useFeaturedListings.ts`**: Wraps `useInfiniteQuery` with hardcoded `is_featured = true`, ordered by `listing_priority DESC, created_at DESC`. PAGE_SIZE = 20.
- **Modify `app/(tabs)/index.tsx`**: Change line 182 `router.push({ pathname: '/explore' })` → `router.push('/featured')`.

Pros:
- Clean separation of concerns — dedicated hook for featured-only queries
- Standalone route doesn't pollute the tab navigator
- Query key `['listings', 'featured']` is distinct from explore's `['listings', 'explore', filters]` — no cache collisions
- Simple implementation, low effort

Cons:
- Some code duplication with `useListingsInfinite.ts` (Supabase query structure)
- Another hook file to maintain

Effort: **Low**

### Approach B: Reuse `useListingsInfinite` with Pre-set Filters

Create `app/featured.tsx` that directly calls `useListingsInfinite({ filter: 'featured', sortBy: 'recent' })` with all other params undefined.

- **New file `app/featured.tsx`**: Same as Approach A but uses existing `useListingsInfinite` directly.
- **No new hook file** — just pass hardcoded filter values.
- **Modify `app/(tabs)/index.tsx`**: Same nav change as Approach A.

Pros:
- Zero hook duplication — reuses existing infinite query infrastructure
- Less code to maintain
- Same query key structure, automatic cache sharing with explore's featured filter

Cons:
- The query key includes all filter params, so navigating between explore (featured filter) and this screen won't share cache perfectly (different key shape)
- Hook is coupled to explore's filter interface even when only one filter matters
- Less semantic — calling `useListingsInfinite` for a "featured-only" screen is less clear

Effort: **Low** (slightly less than A)

### Approach C: Shared Query Key + Prefetch from Home

Same as A or B, but add prefetching: when home screen renders featured section, prefetch the first page of the infinite query so the featured screen opens instantly.

- Same implementation as A or B for the screen + hook
- Add `queryClient.prefetchInfiniteQuery` in home screen's `useFocusEffect` or on "Ver todos" press
- Could use `router.push` with a slight delay to let prefetch start

Pros:
- Better UX — instant load on navigate
- Leverages TanStack Query's cache warming

Cons:
- Slightly more complex
- Prefetch might fire unnecessarily if user never navigates
- Marginal benefit if query is fast (Supabase with proper indexes)

Effort: **Low-Medium**

## Recommendation

**Approach A: Standalone Route + Dedicated Hook**

Reasoning:
1. **Clean architecture**: A dedicated `useFeaturedListings` hook is semantically clear, has a single responsibility, and avoids coupling to the explore filter interface.
2. **Cache isolation**: Different query key means navigating between explore and featured doesn't cause unnecessary refetches or stale data issues.
3. **Simplicity**: The hook is ~30 lines. The screen is a simplified copy of explore.tsx without search/filter/sort UI. No database changes needed.
4. **Follows existing patterns**: The codebase already has `useListings.ts`, `useListingsInfinite.ts`, `useListing.ts` — separate hooks per use case is the established convention.
5. **Route is trivial**: Expo Router auto-discovers `app/featured.tsx`. No `_layout.tsx` changes needed. Navigation is just `router.push('/featured')`.

Approach B is acceptable if the team prefers DRY over separation, but the coupling cost is higher than the dedup savings.

Approach C adds complexity for marginal UX gain — can be a follow-up.

## Risks

1. **Low featured listing count**: If very few listings are featured (e.g., < 10), the infinite scroll screen will feel empty. Mitigation: show a "Ver planes" CTA banner (like the home screen already does) when few results are returned.
2. **Query key mismatch**: If `useListings` (home) and `useFeaturedListings` (new screen) both fetch featured data, they won't share cache. This is actually fine — home fetches 20 total and filters, while the new hook fetches 20 featured specifically. Different scopes, different keys.
3. **No `featured_until` expiry enforcement in query**: The DB has `featured_until` columns but the current queries don't filter by them. This is an existing issue, not introduced by this change. Worth noting for future work.
4. **Tab bar hidden on navigate**: Standalone screens (pushed onto Stack) will hide the tab bar by default. This is correct behavior — the featured screen should have a back button, not a tab bar.

## Ready for Proposal

**Yes** — all technical details are clear. The implementation is straightforward with minimal risk. The DB index already covers the query pattern, TanStack Query is already set up, and the explore screen provides a proven template for infinite scroll with FlatList.
