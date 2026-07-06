# Listing Editing Specification

## Purpose

Allow owners to edit listings by reusing the publish form with `?edit=id`. Editable: title, description, price, price_type, location, images, category_id. Non-editable (id, user_id, created_at, is_featured, listing_priority, rating, reviews_count) MUST NOT be modified.

## Requirements

### Requirement: Edit entry via publish form

The system MUST route to `publish.tsx?edit={id}` when the owner taps "Editar".

#### Scenario: Owner taps edit

- GIVEN the authenticated user owns the listing
- WHEN the user taps "Editar" from the owner menu
- THEN the system MUST navigate to `/publish?edit={listing.id}`

#### Scenario: Non-owner sees no edit option

- GIVEN the authenticated user does NOT own the listing
- WHEN the detail screen renders
- THEN "Editar" MUST NOT appear
- AND "Contactar" MUST be shown instead

### Requirement: Form prefill on edit

The system MUST fetch the listing by `?edit=id` and prefill all editable fields.

#### Scenario: All fields prefilled

- GIVEN the user navigates to `publish.tsx?edit={id}`
- AND the listing exists and belongs to the user
- WHEN the form renders
- THEN title, description, price, price_type, location, category_id MUST match stored values
- AND existing images MUST display with a remove (X) button each

#### Scenario: Edit param for non-existent listing

- GIVEN the user navigates to `publish.tsx?edit={nonExistentId}`
- WHEN the form fetches the listing
- THEN the system MUST show "Aviso no encontrado"
- AND render in create mode without prefill

#### Scenario: Edit param for another user's listing

- GIVEN the user navigates to `publish.tsx?edit={id}`
- AND the listing's user_id differs from the authenticated user
- WHEN the form fetches the listing
- THEN the system MUST show "No tienes permiso para editar este aviso"
- AND render in create mode without prefill

### Requirement: Image editing during edit

Users MAY remove existing images and add new ones without losing unmodified ones. Removed images MUST be queued for backend cleanup.

#### Scenario: Remove existing image

- GIVEN the form is in edit mode with 3 existing images
- WHEN the user taps X on one image
- THEN that image MUST be removed from the local set
- AND its URL MUST be queued for `deleteImage()` on save

#### Scenario: Add new image during edit

- GIVEN the form is in edit mode with existing images
- WHEN the user picks a new image
- THEN the new image MUST appear alongside existing ones
- AND MUST be uploaded to Storage on save

### Requirement: Save updates via UPDATE

The system MUST call `.update()` instead of `.insert()` when `?edit=id` is present. Only editable fields MUST be sent.

#### Scenario: Successful update

- GIVEN the form is in edit mode with modified title and price
- WHEN the user taps "Guardar cambios"
- THEN the system MUST call `.update()` on the matching row
- AND invalidate `['listings']` and `['my-listings']` cache
- AND show success toast "Aviso actualizado"
- AND navigate back

#### Scenario: Update with image removals

- GIVEN the form is in edit mode
- AND the user removed 2 of 4 existing images
- WHEN the user saves
- THEN `deleteImage()` MUST be called for each removed URL
- AND the images column MUST store remaining + new URLs
- AND upload failure MUST NOT prevent the DB update

#### Scenario: Validation failure on save

- GIVEN the form is in edit mode
- AND the user cleared the title field
- WHEN the user taps "Guardar cambios"
- THEN the system MUST show "Ingresa un titulo"
- AND MUST NOT call `.update()`

#### Scenario: Network error during update

- GIVEN the form is in edit mode with valid changes
- WHEN the `.update()` call fails
- THEN an error toast MUST be shown
- AND the form MUST remain editable with unsaved changes intact
