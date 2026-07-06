# Design: Edit & Delete Listings

## Technical Approach

Reuse `publish.tsx` as a dual-purpose form by reading `?edit=id` from the URL — same validation, same UI, different submit path. Owner menus use a lightweight `ActionSheet` modal (no new deps — reuses `BottomSheetDialog` pattern). Image diff is tracked client-side: `initialImages` snapshot on mount vs current `images` state. Mutations live in `useListings.ts` with `useMutation`. Soft-delete sets `status='inactive'`; image cleanup is fire-and-forget.

## Architecture Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Owner menu component | zeego native menu vs `ActionSheet` modal | Custom `ActionSheet` modal | `zeego` not in deps; iOS-only; codebase already uses modal patterns. A 30-line `ActionSheet` component is trivially reusable in detail + profile. |
| Edit form approach | Dedicated edit screen vs. `?edit=id` param | `publish.tsx?edit={id}` | Eliminates code duplication; single form component to maintain. Spec requires this. |
| Image diff strategy | Server-side diff (compare DB on save) vs. client-side tracking | Client-side `initialImages` snapshot | No round-trip needed at save time; `images` state already exists. Compute removed = `initialImages.filter(u => !currentImages.includes(u))`. Existing `uri.startsWith('http')` distinguishes uploaded from local. |
| Mutation library | Direct `supabase.update()` in component vs. `useMutation` | `useMutation` in `useListings.ts` | Consistent with existing TanStack Query setup; enables `onSuccess` cache invalidation. |
| Query invalidation | Optimistic update vs. refetch | `invalidateQueries` in `onSuccess` | Safer than optimistic (no stale UI); listings are small payloads. Both `['listings']` and `['my-listings']` invalidated. |

## Data Flow

### Edit flow

```
Owner taps "Editar"
  → navigate to /publish?edit={id}
  → publish.tsx reads useLocalSearchParams().edit
  → fetch listing by id, validate user_id === user.id
  → prefill: setTitle, setDescription, ..., setImages(existing URLs)
  → [snapshot initialImages = [...images]]
  → user edits fields / removes images / adds new images
  → tap "Guardar cambios"
  → compute removed = initialImages.filter(u => !images.includes(u))
  → await Promise.allSettled(removed.map(deleteImage))  // fire-and-forget
  → upload new local URIs via uploadImage()
  → supabase.from('listings').update({ ...editable fields })
  → invalidateQueries(['listings', 'my-listings'])
  → showSuccess → router.back()
```

### Delete flow

```
Owner taps "Eliminar" (detail ⋮ menu or profile card)
  → show ActionSheet with "Eliminar" option
  → show BottomSheetDialog("Eliminar aviso", "Las imágenes se eliminarán...")
  → tap "Eliminar" (destructive)
  → deleteMutation.mutate(listingId)
  → supabase.from('listings').update({ status: 'inactive' }).eq('id', id)
  → onSuccess:
    → listing.images.forEach(deleteImage)           // fire-and-forget
    → invalidateQueries(['listings', 'my-listings'])
    → showSuccess("Aviso eliminado")
    → router.back()
  → onError:
    → showError("Error al eliminar el aviso")
```

## Image Management

Three distinct image states during edit — tracked locally:

| State | Identifier | Handling on Save |
|-------|-----------|------------------|
| **Existing** (unchanged) | URL starts with `http` AND present in both `initialImages` and `images` | Kept in DB — no action |
| **Removed** | URL in `initialImages` but NOT in `images` | Queued for `deleteImage()` before DB update |
| **New** | URI does NOT start with `http` | Uploaded via `uploadImage()`; returned URL stored in DB |

Upload failures MUST NOT block the DB update — new images that fail upload are omitted, the rest save. Image cleanup failures are `console.error`-logged only.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/(tabs)/publish.tsx` | Modify | Read `?edit=id`, fetch+validate listing, prefill form, switch insert to update, compute image diff on save |
| `app/listing/[id].tsx` | Modify | Owner detection → replace "Contactar" with ⋮ menu; add delete confirmation flow |
| `app/(tabs)/profile.tsx` | Modify | Add ⋮ overlay on each `ListingCard`; open same action sheet |
| `components/ListingCard.tsx` | Modify | Add optional `onEdit`/`onDelete` props; render action button when provided |
| `components/ActionSheet.tsx` | Create | Reusable bottom action sheet modal (options list, destructive styling) |
| `hooks/useListings.ts` | Modify | Add `useEditListing` and `useDeleteListing` mutations with cache invalidation |
| `hooks/useListing.ts` | Create | Single-listing fetch hook for edit prefill (used in publish.tsx) |

## Key Interfaces

```typescript
// hooks/useListings.ts — new mutations
useEditListing(): UseMutationResult<..., { id: string; updates: Partial<Listing>; removedImages: string[]; newImages: string[] }>
useDeleteListing(): UseMutationResult<..., string>  // listing id

// components/ActionSheet.tsx
interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  options: Array<{ label: string; icon?: ReactNode; destructive?: boolean; action: () => void }>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| TypeScript | All new/modified files pass `tsc --noEmit` | `npm run typecheck` |
| Lint | No warnings in touched files | `npm run lint` |
| Manual | Edit flow: create listing → edit all fields → verify DB row updated | Dev server QA |
| Manual | Delete flow: create listing → delete → verify `status='inactive'` + images removed from Storage | Dev server QA |
| Manual | Edge: edit non-owned listing → see "permiso denegado" → create mode | Dev server QA |
| Manual | Edge: delete → cancel → listing still active | Dev server QA |

## Open Questions

None. The design maps cleanly to existing patterns — mutations follow TanStack Query conventions, image handling extends existing `upload.ts` APIs, and the action sheet reuses established modal patterns.
