# Design: Notification System

## Technical Approach

Database-first notification system. Postgres triggers insert into a `notifications` table on relevant events (reviews, subscription expiry). The client polls unread count via `useFocusEffect` on the Home tab — no Realtime subscriptions. A bell icon in the Home header displays the unread badge; tapping it navigates to a full notification screen with history, read/unread states, swipe-to-delete, and mark-all-read.

## Architecture Decisions

### Decision: DB Triggers vs Edge Functions for Notification Creation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Postgres trigger on `reviews` INSERT | Atomic, zero-latency, no cold start. Runs inside the same transaction. | **Chosen** — matches existing `trg_recalculate_ratings` pattern |
| Supabase Edge Function (pg_cron) | More flexible for complex logic, but adds latency and a separate deployment surface | Rejected — triggers are sufficient and already established |
| Client-side insert after review | Adds code duplication, race conditions if user submits from multiple devices | Rejected |

For subscription expiry: a `pg_cron` scheduled job runs daily, inserts a single notification 3 days before `expires_at` for users whose subscription is active and who haven't already received the expiry notification. This mirrors the existing daily cron pattern referenced in the proposal.

### Decision: useFocusEffect Polling vs Realtime

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `useFocusEffect` + TanStack Query refetch | Simple, no channel management, ~30s staleTime means minimal DB load | **Chosen** — matches `useUnreadCount` and messages tab patterns |
| Supabase Realtime channel | True push, but requires channel subscription management, reconnection logic, and is overkill for a badge counter | Rejected — proposal explicitly excludes Realtime |
| setInterval polling | Wastes battery when tab is backgrounded | Rejected |

### Decision: Hybrid Persistence (Bell Badge vs Tab Badge)

The bell icon in the Home header replaces the Messages tab badge as the single notification entry point. Messages tab badge is removed from `_layout.tsx` — message unread count is still available inside the Messages screen but no longer shown on the tab bar.

## Data Flow

```
[DB Trigger / pg_cron]
       │
       ▼
  notifications table (INSERT)
       │
       ▼
  Home tab focus (useFocusEffect)
       │
       ▼
  useUnreadNotifications(userId) ──→ supabase: COUNT WHERE is_read = false
       │
       ▼
  Bell icon badge (number overlay on Bell icon)
       │
       ▼ (tap)
  /notifications screen
       │
       ├── useNotifications(userId) ──→ supabase: SELECT * ORDER BY created_at DESC LIMIT 100
       ├── Tap notification ──→ mark as read + navigate to /listing/[id]
       ├── Swipe left ──→ delete notification row
       └── "Marcar todo leído" ──→ supabase: UPDATE SET is_read = true WHERE user_id = X
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260712000001_add_notifications.sql` | Create | `notifications` table, RLS, indexes, trigger function `fn_notify_on_review`, pg_cron schedule for subscription expiry |
| `types/index.ts` | Modify | Add `Notification` interface |
| `hooks/useNotifications.ts` | Create | `useNotifications(userId)` — paginated list (100 latest), `useUnreadNotificationCount(userId)` — badge count, `useMarkAllRead(userId)` mutation, `useDeleteNotification()` mutation |
| `app/notifications.tsx` | Create | Full notification screen with orange header, list, swipe-to-delete, mark-all-read |
| `app/(tabs)/index.tsx` | Modify | Add Bell icon (lucide `Bell`) with unread badge in header row, right side. Use `useUnreadNotificationCount` hook. Wrap in `TouchableOpacity` → `router.push('/notifications')` |
| `app/(tabs)/_layout.tsx` | Modify | Remove `useUnreadCount` import and badge from Messages tab (`tabBarBadge` → removed) |

## Interfaces / Contracts

### TypeScript Type

```typescript
// types/index.ts — appended after Subscription interface
export interface Notification {
  id: string;
  user_id: string;
  type: 'review' | 'subscription_expiry';
  title: string;
  body: string;
  data: Record<string, unknown> | null; // e.g. { listing_id: "..." }
  is_read: boolean;
  created_at: string;
}
```

### Hook Signatures

```typescript
// hooks/useNotifications.ts
export function useNotifications(userId: string | undefined): UseQueryResult<Notification[]>
// Query: SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100
// staleTime: 30_000

export function useUnreadNotificationCount(userId: string | undefined): UseQueryResult<number>
// Query: SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false
// staleTime: 30_000

export function useMarkAllRead(userId: string | undefined): UseMutationResult
// Mutation: UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false
// Invalidates ['notificationCount', userId]

export function useDeleteNotification(): UseMutationResult
// Mutation: DELETE FROM notifications WHERE id = $1
// Invalidates ['notifications', userId] and ['notificationCount', userId]
```

## Migration Plan

### Table: `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('review', 'subscription_expiry')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Indexes

- `idx_notifications_user_id` ON `notifications(user_id)` — primary lookup
- `idx_notifications_user_unread` ON `notifications(user_id) WHERE is_read = false` — partial index for badge count query (Supabase best practice: partial indexes for filtered queries)

### RLS Policies

- **SELECT**: `auth.uid() = user_id` — users see only their own notifications
- **INSERT**: `false` (server-only via triggers/service role)
- **UPDATE**: `auth.uid() = user_id` — mark as read
- **DELETE**: `auth.uid() = user_id` — swipe to delete

### Trigger: `fn_notify_on_review`

```sql
CREATE OR REPLACE FUNCTION fn_notify_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_listing_owner uuid;
  v_listing_title text;
BEGIN
  SELECT l.user_id, l.title INTO v_listing_owner, v_listing_title
  FROM conversations c JOIN listings l ON l.id = c.listing_id
  WHERE c.id = NEW.conversation_id;

  IF v_listing_owner IS NOT NULL AND v_listing_owner != NEW.reviewer_id THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_listing_owner,
      'review',
      'Nueva calificacion',
      'Calificaron tu aviso "' || v_listing_title || '"',
      jsonb_build_object('listing_id', (SELECT listing_id FROM conversations WHERE id = NEW.conversation_id))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_review ON reviews;
CREATE TRIGGER trg_notify_on_review
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION fn_notify_on_review();
```

### pg_cron: Subscription Expiry Notifications

```sql
-- One notification per user, 3 days before expiry, max once per expiry cycle
SELECT cron.schedule(
  'subscription_expiry_notifications',
  '0 10 * * *',
  $$INSERT INTO notifications (user_id, type, title, body, data)
    SELECT p.id, 'subscription_expiry',
           'Tu suscripcion esta por vencer',
           'Tu suscripcion vence el ' || to_char(s.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
           jsonb_build_object('expires_at', s.expires_at)
    FROM profiles p
    JOIN subscriptions s ON s.user_id = p.id
    WHERE s.status = 'active'
      AND s.expires_at BETWEEN now() AND now() + interval '4 days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = p.id
          AND n.type = 'subscription_expiry'
          AND n.data->>'expires_at' = to_char(s.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS')
      )$$
);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| DB Trigger | Review INSERT creates notification for listing owner | `npm run typecheck` passes; manual Supabase SQL editor test: insert review → check notifications row |
| DB Trigger Edge Case | Reviewer == listing owner → no notification | SQL test: verify no row inserted |
| pg_cron | Expiry notification created 3 days before | SQL test: insert subscription expiring in 3 days → run cron job manually → check notification |
| pg_cron Dedup | Same expiry doesn't create duplicate | Run cron twice → verify single row |
| UI: Bell Badge | Unread count displayed correctly | Login → insert test notification via SQL → Home tab shows badge |
| UI: Navigation | Tap bell → notification screen | Verify `/notifications` route loads |
| UI: Mark Read | Tap notification → marks read, badge decrements | Tap notification → verify is_read = true, badge count -1 |
| UI: Swipe Delete | Swipe → delete notification | Swipe row → verify row removed from DB |
| UI: Mark All Read | Button clears all unread | Tap "Marcar todo leído" → badge disappears |
| UI: Deleted Listing | Notification links to deleted listing | Tap notification where listing_id references deleted listing → show "ya no existe" |
| Typecheck | `npm run typecheck` clean | Run build command |

## Open Questions

- [ ] pg_cron requires Supabase plan support — verify the project has pg_cron enabled. If not, fallback: client-side subscription expiry check on app open (check `subscription_expires_at` in profile, show notification if within 3 days).
- [ ] The `notifications` table will grow unbounded (no cleanup in v1). At ~100 notifications per user per year this is negligible. Revisit if storage becomes a concern.
