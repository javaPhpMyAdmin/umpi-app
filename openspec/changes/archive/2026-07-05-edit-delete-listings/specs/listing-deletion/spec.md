# Listing Deletion Specification

## Purpose

Allow listing owners to soft-delete their listings by setting `status='inactive'`. Deleted listings MUST be hidden from all listing queries and MUST trigger image cleanup via `deleteImage()`. Deletion MUST require explicit confirmation via BottomSheetDialog.

## Requirements

### Requirement: Delete entry point

The owner MUST be able to initiate deletion from the listing detail screen and from their profile listing cards.

#### Scenario: Delete button on listing detail

- GIVEN the authenticated user owns the listing
- WHEN the user opens the listing detail screen
- THEN an actions menu (⋮) MUST be visible
- AND the menu MUST contain an "Eliminar" option

#### Scenario: Delete button on profile card

- GIVEN the authenticated user views their profile
- WHEN the user taps the context menu on a `ListingCard`
- THEN the menu MUST contain an "Eliminar" option

#### Scenario: Non-owner cannot delete

- GIVEN the authenticated user does NOT own the listing
- WHEN the listing detail screen renders
- THEN the "Eliminar" option MUST NOT appear
- AND the actions menu MUST NOT be shown

### Requirement: Delete confirmation dialog

The system MUST show a BottomSheetDialog asking the user to confirm deletion. The dialog MUST warn that the action is irreversible.

#### Scenario: Confirm delete

- GIVEN the user tapped "Eliminar" on their listing
- WHEN the BottomSheetDialog appears
- THEN the title MUST be "Eliminar aviso"
- AND the message MUST warn that images will be removed
- AND a "Eliminar" button (with destructive/danger styling) MUST be present
- AND a "Cancelar" button MUST dismiss the dialog

#### Scenario: Cancel delete

- GIVEN the BottomSheetDialog is visible
- WHEN the user taps "Cancelar"
- THEN the dialog MUST close
- AND the listing MUST remain unchanged with `status='active'`

### Requirement: Soft-delete execution

Upon confirmed deletion, the system MUST set `status='inactive'`, call `deleteImage()` for each image, and invalidate relevant query caches.

#### Scenario: Successful soft-delete

- GIVEN the user confirmed deletion via the dialog
- WHEN the mutation executes
- THEN `supabase.from('listings').update({ status: 'inactive' })` MUST be called for that listing id
- AND `deleteImage()` MUST be called for each URL in the listing's images array
- AND the query cache MUST be invalidated for `['listings']` and `['my-listings']`
- AND a success toast "Aviso eliminado" MUST be shown
- AND the user MUST be navigated back (to previous screen or profile)

#### Scenario: Image cleanup failure

- GIVEN the user confirmed deletion
- AND the DB update succeeds
- BUT `deleteImage()` fails for one or more images
- WHEN the mutation completes
- THEN the DB update MUST still be committed (status='inactive')
- AND the failed deletions MUST be logged to console.error
- AND the success flow MUST complete (toast + navigate back)

#### Scenario: Network error during delete

- GIVEN the user confirmed deletion
- WHEN the DB `.update()` call fails
- THEN the system MUST show an error toast "Error al eliminar el aviso"
- AND the listing MUST remain `status='active'`

### Requirement: Deleted listings are hidden

Listings with `status='inactive'` MUST NOT appear in any listing query. The existing `status='active'` filter in all queries is sufficient.

#### Scenario: Deleted listing absent from browse

- GIVEN a listing was soft-deleted (status='inactive')
- WHEN any user opens the home or explore screen
- THEN the deleted listing MUST NOT appear in the results

#### Scenario: Deleted listing absent from owner's profile

- GIVEN the owner soft-deleted a listing
- WHEN the owner views their profile
- THEN the deleted listing MUST NOT appear in "Mis publicaciones"
- AND the listing count SHOULD reflect only active listings
