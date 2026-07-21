# Tasks: Notification System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~345 (additions + modifications) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Database Migration

- [x] 1.1 Create `supabase/migrations/20260712000001_add_notifications.sql` with `notifications` table (uuid PK, user_id FK → auth.users CASCADE, type CHECK, title, body, data jsonb, is_read boolean, created_at timestamptz)
- [x] 1.2 Add indexes: `idx_notifications_user_id` on `(user_id)`, partial index `idx_notifications_user_unread` on `(user_id) WHERE is_read = false`
- [x] 1.3 Add RLS policies: SELECT/UPDATE/DELETE where `user_id = auth.uid()`, INSERT for authenticated user OR service_role
- [x] 1.4 Add trigger function `fn_notify_on_review()` — on INSERT into `reviews`, look up listing owner via `conversations → listings`, insert notification if reviewer ≠ owner
- [x] 1.5 Create trigger `trg_notify_on_review` AFTER INSERT ON reviews

## Phase 2: Types & Hooks

- [x] 2.1 Add `Notification` interface to `types/index.ts` after `Subscription`: id, user_id, type (`'review' | 'subscription_expiry'`), title, body, data (Record<string, unknown> | null), is_read, created_at
- [x] 2.2 Create `hooks/useNotifications.ts` with `useNotifications(userId)` — SELECT * WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100, staleTime 30s
- [x] 2.3 Add `useUnreadNotificationCount(userId)` — SELECT COUNT(*) WHERE is_read = false, staleTime 30s
- [x] 2.4 Add `useMarkAllRead(userId)` mutation — UPDATE SET is_read = true WHERE user_id = $1 AND is_read = false, invalidates notificationCount
- [x] 2.5 Add `useDeleteNotification()` mutation — DELETE FROM notifications WHERE id = $1, invalidates notifications + notificationCount

## Phase 3: UI — Bell Icon & Notification Screen

- [x] 3.1 Create `app/notifications.tsx` — orange header with "Notificaciones", FlatList of notifications, empty state "No tenés notificaciones"
- [x] 3.2 Add reverse-chronological list with relative timestamps (hace X horas/minutos) using `date-fns` or manual calculation
- [x] 3.3 Style unread items with bold title and accent background; read items with normal style
- [x] 3.4 Implement swipe-to-delete using `Swipeable` from `react-native-gesture-handler` — calls `useDeleteNotification` mutation
- [x] 3.5 Add "Marcar todo leído" header button calling `useMarkAllRead` mutation
- [x] 3.6 On notification tap: mark as read (update cache), navigate to `/listing/[id]` for review type or `/plans` for subscription_expiry type
- [x] 3.7 Handle deleted listing case — query listing, show "Este aviso ya no existe" if null, still mark read
- [x] 3.8 Modify `app/(tabs)/index.tsx` — add Bell icon (lucide `Bell`) with unread badge in header right, wrapped in TouchableOpacity → `router.push('/notifications')`
- [x] 3.9 Use `useUnreadNotificationCount` hook + `useFocusEffect` for badge refresh on tab focus

## Phase 4: Badge Integration

- [x] 4.1 Modify `app/(tabs)/_layout.tsx` — remove `useUnreadCount` import and `tabBarBadge` prop from Messages tab
- [x] 4.2 Verify Messages tab still navigates correctly without badge

## Phase 5: Subscription Expiry Cron

- [x] 5.1 Add pg_cron schedule `subscription_expiry_notifications` (daily 10:00 AM) in migration — inserts notification for users with active subscription expiring in 3 days, dedup via NOT EXISTS check on existing `subscription_expiry` notification
- [x] 5.2 Verify pg_cron is enabled on the Supabase project; if not, document fallback: client-side check on app open reading `subscription.expires_at` from profile

## Phase 6: Verification

- [x] 6.1 Run `npm run typecheck` — verify no new type errors
- [x] 6.2 Run `npm run lint` — verify no lint warnings
- [x] 6.3 Manual test: insert review via Supabase SQL editor → verify notification row created and bell badge appears
- [x] 6.4 Manual test: tap bell → notification screen loads with correct item → tap notification → navigates to listing detail, badge decrements
- [x] 6.5 Manual test: swipe-to-delete removes notification from list and DB
- [x] 6.6 Manual test: "Marcar todo leído" clears badge
- [x] 6.7 Manual test: verify Messages tab has no badge in tab bar
