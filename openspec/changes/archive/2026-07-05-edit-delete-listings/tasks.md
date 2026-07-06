# Tasks: Edit & Delete Listings

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340-380 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation

- [x] **1.1 Create `components/ActionSheet.tsx`** — Reusable bottom sheet modal with options list (label, icon?, destructive?, action). Uses Modal + Pressable overlay. Destructive option renders in `Colors.error`. Deps: none. AC: renders options; destructive styled red; tapping option fires action + closes.
- [x] **1.2 Create `hooks/useListing.ts`** — `useListing(id: string)` hook with `useQuery(['listing', id])` fetching single listing via `supabase.from('listings').select('*').eq('id', id).maybeSingle()`. Returns `Listing | null`. Deps: none. AC: fetches by id; returns null for missing; `tsc --noEmit` passes.
- [x] **1.3 Add mutations to `hooks/useListings.ts`** — Add `useEditListing()` mutation: calls `.update()` on listings table with `Partial<Listing>` (only editable fields), `removedImages: string[]` (calls `deleteImage()` per URL in `onSuccess`, fire-and-forget), invalidates `['listings']` and `['my-listings']`. Add `useDeleteListing()`: sets `status='inactive'`, same invalidation. Deps: none. AC: mutations exist; cache invalidated on success; image cleanup is fire-and-forget.

## Phase 2: Edit Mode

- [x] **2.1 `publish.tsx` — edit param handling** — Read `?edit=id` via `useLocalSearchParams()`. When present, call `useListing(id)` on mount. Validate `listing.user_id === user.id` (error toast + create mode fallback). Prefill all form state (title, description, price, price_type, location, category_id, images). Snapshot `initialImages` for diff. Deps: 1.2. AC: edit param fetches + prefills; wrong owner shows "No tienes permiso" toast; missing id shows "Aviso no encontrado".
- [x] **2.2 `publish.tsx` — update submit path** — When `?edit=id` is set, `handlePublish` calls `.update()` instead of `.insert()`. Compute removed = `initialImages.filter(u => !images.includes(u))`. Fire `deleteImage()` per removed (fire-and-forget). Upload new local URIs. Invalidate caches. Show "Aviso actualizado" toast, `router.back()`. Button text: "Guardar cambios". Deps: 1.3, 2.1. AC: update writes to DB; removed images cleaned; new images uploaded; cache refreshed; back nav on success.

## Phase 3: Owner Menus

- [x] **3.1 `app/listing/[id].tsx` — owner menu + delete** — If `listing.user_id === user.id`, show `ActionSheet` in bottom bar replacing "Contactar". Options: "Editar" → `router.push('/publish?edit={id}')`; "Eliminar" (destructive) → open `BottomSheetDialog` with "Eliminar aviso" / warning / destructive "Eliminar" button. Confirm fires `useDeleteListing().mutate(id)` → success toast "Aviso eliminado" → `router.back()`. Deps: 1.1, 1.3. AC: owner sees ⋮ menu; non-owner sees "Contactar"; delete confirm works; error handled.
- [x] **3.2 `components/ListingCard.tsx` — action props** — Add optional `onEdit?: () => void` and `onDelete?: () => void` to `ListingCardProps`. When provided, render a "more" button (⋮ or `MoreHorizontal` icon) positioned top-right on the card image. Deps: none. AC: props are optional; button only renders when at least one is set; no visual change in existing usage.
- [x] **3.3 `app/(tabs)/profile.tsx` — card actions** — Pass `onEdit` and `onDelete` to each `ListingCard` in the grid. `onEdit` navigates to `/publish?edit={id}`. `onDelete` opens the same `ActionSheet` → `BottomSheetDialog` → `useDeleteListing` flow. Deps: 3.2, 1.1, 1.3. AC: profile cards show action button; edit navigates; delete confirms + removes.

## Phase 4: Verification

- [x] **4.1 TypeScript + lint** — Run `npm run typecheck` and `npm run lint`. Fix any type errors or lint warnings in all 7 touched files. Deps: all prior. AC: `tsc --noEmit` passes; `npm run lint` passes.
- [ ] **4.2 Manual QA** — Test edit flow (create → edit all fields → verify DB row updated). Test delete flow (create → delete → verify `status='inactive'` + images removed). Test edge cases: edit non-owned listing, delete → cancel, network error during update. Deps: all prior. AC: all spec scenarios pass.

## File Change Summary

| File | Action | Est. Lines |
|------|--------|------------|
| `components/ActionSheet.tsx` | CREATE | ~60 |
| `hooks/useListing.ts` | CREATE | ~30 |
| `hooks/useListings.ts` | MODIFY | ~45 |
| `app/(tabs)/publish.tsx` | MODIFY | ~100 |
| `app/listing/[id].tsx` | MODIFY | ~70 |
| `app/(tabs)/profile.tsx` | MODIFY | ~35 |
| `components/ListingCard.tsx` | MODIFY | ~25 |
