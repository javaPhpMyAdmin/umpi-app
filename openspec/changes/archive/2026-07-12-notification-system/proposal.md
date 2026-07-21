# Proposal: Notification System

## Intent

Users have no centralized way to know when someone reviews their listing, favorites it, or when their subscription is about to expire. Messages already have a tab badge, but reviews, favorites, and subscription events are invisible until the user manually checks. A unified notification center closes this gap with a single bell icon that absorbs all event types.

## Scope

### In Scope

- `notifications` table (id, user_id, type, title, body, data jsonb, is_read, created_at) with RLS
- DB triggers: `reviews` INSERT, subscription expiry (daily check or trigger)
- Bell icon in Home header (right side) with unread count badge
- Full-screen `app/notifications.tsx` with history, read/unread states, relative dates, swipe-to-delete, mark-as-read-on-tap
- Tap navigates to context (listing detail, etc.); deleted listing shows "ya no existe"
- `Notification` TypeScript type added to `types/index.ts`

### Out of Scope

- Real-time subscriptions (Realtime channels)
- Push notifications or email notifications
- Notification preferences/settings screen
- Complex filtering or category tabs beyond the type field
- Favorites system (deferred)
- Auto-cleanup of old notifications (keep forever)

## Capabilities

### New Capabilities

- `notifications`: notification table, triggers, unread count, bell icon, full notification screen, read/unread states, navigation targets

### Modified Capabilities

- None — messaging spec unchanged; message events flow into the new notification table via the same trigger pattern

## Approach

Database-first: triggers insert into `notifications` on relevant events. Client polls via `useFocusEffect` on Home screen (no Realtime). Bell icon reads unread count from a lightweight query. Notification screen fetches full history with pagination (latest 100). Swipe-to-delete uses Supabase delete. Notifications marked as read individually on tap. Subscription expiry handled by extending the existing daily cron to insert a single notification 3 days before expiry.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | notifications table, triggers, RLS |
| `app/(tabs)/index.tsx` | Modified | Add bell icon + badge to orange header |
| `app/notifications.tsx` | New | Full notification screen |
| `types/index.ts` | Modified | Add Notification type |
| `hooks/useNotifications.ts` | New | Query unread count + notification list |
| `app/(tabs)/_layout.tsx` | Modified | Remove Messages tab badge (absorbed by bell) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Subscription expiry cron complexity | Low | Extend existing cron; fallback: client-side check on app open |
| Notification table growth | Low | Swipe-to-delete; no auto-cleanup in v1 |
| Stale unread count | Low | useFocusEffect refreshes on tab focus |

## Rollback Plan

Drop `notifications` table via migration rollback. Remove bell icon from Home header. Restore Messages tab badge in `_layout.tsx`. Delete `app/notifications.tsx` and `hooks/useNotifications.ts`.

## Dependencies

- Existing `reviews` table (reviews system already deployed)
- Existing `subscriptions` table (MercadoPago integration already deployed)
- Existing daily cron for subscription expiry

## Success Criteria

- [ ] Bell icon visible in Home header with correct unread count
- [ ] Tapping bell navigates to notification screen
- [ ] Notification screen shows all notification types with correct read/unread styling
- [ ] Swipe-to-delete removes individual notifications
- [ ] Mark-all-read clears the badge
- [ ] Review notification created automatically on INSERT into reviews
- [ ] Subscription expiry notification created by daily cron (single notification, 3 days before)
- [ ] Messages tab badge removed (absorbed by bell)
- [ ] `npm run typecheck` passes clean

## User Decisions (from question round)

| Question | Decision |
|---|---|
| Aviso eliminado al tocar | Mostrar "Este aviso ya no existe" |
| Favoritos | No se necesita por ahora — fuera del alcance |
| Retención de notificaciones | Para siempre, sin cleanup |
| Frecuencia suscripción vencimiento | Una sola notificación, 3 días antes |
| Marcar como leído | Al tocar cada notificación individualmente |
