# Destacados no es una categoría

**Fecha:** 2026-07-06
**Contexto:** Categorías en screens de publicar/editar avisos.

## Problema

En Inicio y Explorar, `Todos` y `Destacados` son útiles como **filtros**. Pero en el screen de publicar/editar (publish.tsx), tenerlos como categorías seleccionables genera problemas semánticos.

### Todos

- Un aviso no puede pertenecer a "todas las categorías".
- Si se selecciona en publish/edit, el `category_id` queda inválido (no pasa el regex UUID) y el aviso termina sin categoría.
- **Solución:** filtrar `slug = 'todos'` del fetch de categorías en publish.tsx.

### Destacados

- `Destacados` es un **estado del aviso** (`is_featured: boolean`), no una categoría real.
- Si un usuario publica en "Destacados", el aviso pierde su categoría real (Autos, Servicios, etc.) y no aparece en esos filtros.
- Depende del plan de suscripción del usuario: los planes tienen un límite de avisos destacados por período.

## Decisión

1. `Destacados` no debe aparecer como categoría seleccionable en publish/edit.
2. Cuando se implemente el sistema de suscripciones, agregar un control separado en publish que:
   - Muestre el límite disponible según el plan del usuario.
   - Setee `is_featured = true` en el listing.
   - Descuente del contador del plan.
3. La categoría real del aviso debe ser siempre una concreta (Autos, Servicios, etc.).

## Estado actual

- `todos` ya está filtrado del fetch en publish.tsx (`.neq('slug', 'todos')`).
- `destacados` NO está filtrado aún — se discutió que debería seguir la misma suerte que `todos` por el mismo motivo semántico, pero falta implementar el filtro.
- Inicio y Explorar mantienen ambos como filtros — no se tocan.

## Pendiente para el sistema de suscripciones

- Modelar planes con `max_featured_listings: int` y `featured_period_days: int`.
- En publish/edit: toggle "Destacar aviso" que verifique el límite del plan antes de setear `is_featured`.
- En el perfil: mostrar contador de destacados usados / disponibles.
