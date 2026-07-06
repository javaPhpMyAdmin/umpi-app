# Proposal: Edit & Delete Listings

## Intent

Users can create listings but not fix typos, update prices, or remove sold items — forcing workarounds and leaving stale ads visible. Add edit and soft-delete so owners control their content end-to-end.

## Scope

### In Scope
- Reuse publish.tsx via `?edit=id` — prefill form, switch INSERT to UPDATE
- Soft delete (`status='inactive'`) from detail screen and profile
- Owner ⋮ menu on listing detail replaces "Contactar"
- Profile entry point: action slot per listing card
- Delete confirmation via BottomSheetDialog
- Image cleanup: `deleteImage()` for removed images on edit, all images on delete
- Invalidate `['listings']` + `['my-listings']` after mutate

### Out of Scope
- Hard delete (CASCADE FK blocks it), reactivation, admin edit/delete, undo

## Capabilities

### New Capabilities
- `listing-editing`: prefill and update via publish form with `?edit=id`
- `listing-deletion`: soft-delete with confirmation, image cleanup, refetch

### Modified Capabilities
None (no existing specs)

## Approach

1. **publish.tsx**: read `?edit=id` param → fetch listing, prefill form, submit calls `.update()` vs `.insert()`. Track removed images client-side, call `deleteImage()` before uploading new ones.
2. **listing/[id].tsx**: if `listing.user_id === user.id`, render ⋮ native menu (zeego) with "Editar" / "Eliminar". Delete opens BottomSheetDialog → mutation → navigate back.
3. **profile.tsx**: wrap `ListingCard` items with context menu (long-press or ⋮). Same actions as detail screen.
4. **useListings.ts**: add `useEditListing` and `useDeleteListing` mutations. Invalidate `['listings']` and `['my-listings']` on success.
5. **Soft delete**: `.update({ status: 'inactive' })`. Loop listing.images calling `deleteImage()` each.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(tabs)/publish.tsx` | Modified | `?edit=id` param, prefill, UPDATE path |
| `app/listing/[id].tsx` | Modified | Owner ⋮ menu, delete confirmation |
| `app/(tabs)/profile.tsx` | Modified | Context menu on listing cards |
| `hooks/useListings.ts` | Modified | `useEditListing`, `useDeleteListing` mutations |
| `lib/upload.ts` | Unchanged | `deleteImage()` already exists |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Orphaned Storage blobs on failed cleanup | Medium | Fire-and-forget; log errors, proceed with DB update |
| Stale data after mutate | Low | Invalidate both query keys in `onSuccess` |
| `?edit=id` param conflicts | Low | Namespace under `edit` only |

## Rollback Plan

Revert the 4 modified files. No schema changes (soft-delete uses existing `status` column). Orphaned images cleaned via Supabase Storage lifecycle rules.

## Dependencies

- `zeego` (or equivalent native menu) — add if not in lockfile
- `BottomSheetDialog` exists at `@/components/BottomSheetDialog`

## Success Criteria

- [ ] Owner sees ⋮ menu on own listing; non-owner sees "Contactar"
- [ ] Edit prefills all fields, updates row, refreshes lists
- [ ] Delete shows confirmation, removes images, sets `status='inactive'`, navigates back
- [ ] Deleted listings hidden from all queries (filtered by `status='active'`)
