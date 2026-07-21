# Tasks: Featured Infinite Scroll

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~210 (200 new + 1 edit) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Create Featured Screen

- [x] 1.1 Create `app/featured.tsx` — standalone FlatList screen (~200 lines). Import `useListingsInfinite`, `ListingCard`, `SkeletonCard`, `Colors`, `ArrowLeft` from lucide, `useSafeAreaInsets`, `useRouter` from expo-router, `ActivityIndicator`, `TouchableOpacity`, `Text`, `View`, `FlatList` from RN. Call `useListingsInfinite({ filter: 'featured', sortBy: 'recent' })`. Header: `ArrowLeft` + "Destacados" (match `app/plans.tsx` header pattern: `flexDirection: 'row', gap: 12, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12`). Back button calls `router.back()`.

- [x] 1.2 Wire FlatList props: `numColumns={2}`, `onEndReached` triggers `fetchNextPage()` when `hasNextPage && !isFetchingNextPage`, `onEndReachedThreshold={0.3}`, `ListHeaderComponent` shows stats count ("X aviso(s) encontrado(s)"), `ListFooterComponent` shows spinner + "Cargando más avisos..." during `isFetchingNextPage` and "Todos los avisos cargados" when done, `ListEmptyComponent` handles loading (4× `SkeletonCard variant="compact"`), error ("Error al cargar los avisos. Tira de pull-to-refresh."), and empty ("No hay avisos destacados" + "Ver planes" `TouchableOpacity` → `router.push('/plans')`). `renderItem` renders `ListingCard variant="compact"` with 2-column grid spacing matching `explore.tsx`.

- [x] 1.3 Add pull-to-refresh: wrap FlatList in `RefreshControl` using `refetch` from the hook. Set `refreshing={isFetching && !isLoading}`.

## Phase 2: Update Home Navigation

- [x] 2.1 In `app/(tabs)/index.tsx` line 182, change `router.push({ pathname: '/explore' })` to `router.push({ pathname: '/featured' })` inside the "Ver todos" `TouchableOpacity` `onPress`.

## Phase 3: Verification

- [x] 3.1 Run `npm run typecheck` — confirm zero errors. Key check: `useListingsInfinite` query key for `{ filter: 'featured', sortBy: 'recent' }` is `['listings', 'explore', { filter: 'featured', sortBy: 'recent' }]` — different from explore's default `{ filter: 'all', sortBy: 'recent' }`, so no cache collision.

- [x] 3.2 Run `npm run lint` — confirm no lint errors.

- [ ] 3.3 Manual E2E: (a) Home screen "Ver todos" navigates to `/featured`, (b) screen renders without tab bar, (c) scrolling loads more listings, (d) empty state shows when no featured listings, (e) "Ver planes" CTA navigates to `/plans`, (f) pull-to-refresh works.
