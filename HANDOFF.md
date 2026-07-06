# Handoff — 2026-07-05

## Qué se hizo

### Edit & Delete Listings (archivado en `openspec/`)
- Editar publicaciones reusando publish.tsx con `?edit=id`
- Soft delete (`status='inactive'`) con confirmación y limpieza de imágenes
- Menú de dueño con ActionSheet en detalle y perfil
- Mutaciones TanStack Query con invalidación de caché

### Refactors
- Profile migrado a TanStack Query (`useMyListings` hook)
- Toasts con colores sólidos brillantes (verde/rojo/naranja)
- ActionSheet con overlay solo detrás del sheet
- Logs de debug eliminados de AuthContext, publish, upload

### Archivos nuevos
- `components/ActionSheet.tsx`
- `components/BottomSheetDialog.tsx`
- `hooks/useListing.ts`
- `lib/toast.tsx`, `lib/upload.ts`

### Migraciones Supabase (sin committear)
- `20260704000001_create_listing_images_bucket.sql`
- `20260705000002_add_reviews_count_to_profiles.sql`

## Pendiente
- [ ] QA manual — probar editar/eliminar en dev server
- [ ] Verificar que los toasts se vean bien en iOS y Android
- [ ] (Opcional) Arreglar imports sin usar y deps de useEffect

## Ideas para implementar
- **Mensajes / Conversaciones** — planificar el flujo cuando alguien contacta al vendedor desde una publicación: cómo se inicia la conversación, qué se muestra, manejo de estados
- **Galería de imágenes con slider** — cuando una publicación tiene varias fotos, poder deslizar entre ellas en la pantalla de detalle (en lugar de mostrar solo la primera)
- **Color en categorías** — darle más color a los chips de categoría en la pantalla de publicar/editar (usando `CategoryColors`)

## Para continuar
- Leer `openspec/changes/archive/2026-07-05-edit-delete-listings/` para contexto completo
- El SDD Session Preflight está configurado en modo interactivo, OpenSpec, Preguntame
