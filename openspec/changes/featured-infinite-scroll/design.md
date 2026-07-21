# Design: Featured Infinite Scroll

## Technical Approach

Thin standalone screen (`app/featured.tsx`) that reuses the existing `useListingsInfinite` hook with hardcoded `filter: 'featured'`. Modeled after `explore.tsx` but stripped of search, category filter, and sort UI. FlatList handles infinite scroll via `onEndReached`. One navigation target change on the home screen.

## Architecture Decisions

### Decision: FlatList over ScrollView

| Option | Tradeoff | Decision |
|--------|----------|----------|
| FlatList | Virtualized, handles long lists, `onEndReached` built-in | **Chosen** |
| ScrollView | Simple but renders all items, poor perf with 100+ cards | Rejected |

Rationale: explore.tsx already uses FlatList — consistent pattern, and featured lists could grow large.

### Decision: Reuse hook as-is vs. create wrapper

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Direct call | No abstraction, one extra import line | **Chosen** |
| Thin wrapper | Adds indirection, hides what params do | Rejected |

Rationale: The hook's `ExploreFilters` type already supports `filter: 'featured'` + `sortBy: 'recent'`. No wrapper needed — passing hardcoded params directly is clearer.

### Decision: Standalone route vs. tab screen

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Standalone route | No tab bar, clean push/pop, no layout changes | **Chosen** |
| New tab | Adds nav clutter, "Destacados" is not a primary section | Rejected |

Rationale: Expo Router auto-registers `app/featured.tsx` as a push target. No `(tabs)/` layout modification needed.

## Data Flow

```
HomeScreen "Ver todos"
    │
    ▼  router.push('/featured')
FeaturedScreen
    │
    ├── useListingsInfinite({ filter: 'featured', sortBy: 'recent' })
    │       │
    │       ▼
    │   queryFn: supabase.listings
    │       .eq('is_featured', true)
    │       .order('listing_priority', { asc: false })
    │       .order('created_at', { asc: false })
    │       .range(offset, offset + 19)
    │
    ▼
FlatList
    ├── renderItem → ListingCard variant="compact"
    ├── ListEmptyComponent → Empty state / Skeletons / Error
    ├── ListFooterComponent → loader / "all loaded"
    └── onEndReached → fetchNextPage()
```

Query key: `['listings', 'explore', { filter: 'featured', sortBy: 'recent' }]` — different from explore's default `'all'` filter, so no cache collision.

## Route Design

| Route | Type | Tab bar | Navigation |
|-------|------|---------|------------|
| `app/featured.tsx` | Standalone | Hidden (outside `(tabs)/`) | `router.push('/featured')`, `router.back()` |

Header pattern matches `app/plans.tsx`: `ArrowLeft` icon + title, no custom navigation bar.

## Screen Layout

```
┌─────────────────────────┐
│  Status Bar (safe area)  │
│  ←  Destacados           │  ← Header (back button + title)
│─────────────────────────│
│  X aviso(s) encontrado(s)│  ← Stats bar (optional, same as explore)
│─────────────────────────│
│  ┌──────┐  ┌──────┐     │
│  │ Card │  │ Card │     │  ← FlatList, numColumns=2
│  └──────┘  └──────┘     │
│  ┌──────┐  ┌──────┐     │
│  │ Card │  │ Card │     │
│  └──────┘  └──────┘     │
│         ...              │
│  Cargando más avisos...  │  ← ListFooter (isFetchingNextPage)
└─────────────────────────┘
```

Empty state (no featured listings):
```
┌─────────────────────────┐
│  ←  Destacados           │
│                         │
│   No hay avisos         │
│   destacados             │
│                         │
│   [  Ver planes  ]      │  ← TouchableOpacity → /plans
└─────────────────────────┘
```

## State Management

No new state. All state comes from `useListingsInfinite` return values:

| State | Source | Purpose |
|-------|--------|---------|
| `listings` | `data.pages.flatMap(...)` | Flattened paginated array |
| `isLoading` | hook | Show skeleton grid |
| `isFetchingNextPage` | hook | Show footer spinner |
| `hasNextPage` | hook | Trigger `onEndReached` |
| `error` | hook | Show error state |
| `refetch` | hook | Pull-to-refresh |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Supabase query error | `ListEmpty` shows "Error al cargar los avisos. Tira de pull-to-refresh." |
| Empty featured list | `ListEmpty` shows message + "Ver planes" CTA → `router.push('/plans')` |
| Network failure during pagination | Error shown inline in footer; `refetch` recovers |

## Empty/Loading States

| State | Component | Behavior |
|-------|-----------|----------|
| Initial load (`isLoading`) | `SkeletonCard variant="compact"` × 4 in 2×2 grid |
| Empty (no data, no error) | Message + "Ver planes" `TouchableOpacity` → `/plans` |
| Error | Retry message + pull-to-refresh |
| Loading next page | `ActivityIndicator` + "Cargando más avisos..." footer |
| All loaded | "Todos los avisos cargados" footer |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/featured.tsx` | **Create** | Standalone FlatList screen — ~200 lines, modeled on explore.tsx minus search/filter/sort |
| `app/(tabs)/index.tsx` | **Modify** | Line 182: change `/explore` to `/featured` in "Ver todos" `onPress` |

No changes to `useListingsInfinite.ts`, `ListingCard.tsx`, `SkeletonCard.tsx`, or `plans.tsx`.

## Interfaces / Contracts

No new interfaces. The screen uses existing types:

```typescript
// Existing — no changes needed
type ExploreFilters = {
  query?: string;
  categoryId?: string;
  filter: 'all' | 'featured' | 'recent';
  sortBy: 'recent' | 'price_asc' | 'price_desc';
};

// Usage in featured.tsx (hardcoded, no user input)
useListingsInfinite({
  filter: 'featured',
  sortBy: 'recent',
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Lint | `npm run lint` passes | Automated |
| Type check | `npm run typecheck` passes | Automated |
| Manual E2E | "Ver todos" navigates to `/featured`, scroll loads more, empty state shows CTA | Manual verification |

No test framework configured — testing is lint + typecheck + manual.

## Migration / Rollout

No migration required. This is a pure UI change:
1. Add new route file
2. Change one navigation target
3. Rollback: revert index.tsx line, delete featured.tsx

## Open Questions

None. All infrastructure exists. Hook, types, components, and navigation patterns are confirmed in codebase.
