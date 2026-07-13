/*
# Message notifications in bell

1. Extends `notifications.type` CHECK to include `'message'`
2. Creates `sync_message_notifications()` — syncs unread messages as
   notification records, called from the frontend on app open/foreground

Flow: user opens app → frontend calls `sync_message_notifications(id)`
→ function deletes old message notis and inserts fresh ones based on
current unread state → bell badge reflects total unread count

Notification tap → navigates to the conversation
*/

-- 1. Extend type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('review', 'subscription_expiring', 'message'));

-- 2. Sync function: one notification per conversation with unread messages
CREATE OR REPLACE FUNCTION sync_message_notifications(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Remove stale message notifications
  DELETE FROM notifications
  WHERE user_id = p_user_id AND type = 'message';

  -- Insert one notification per conversation with unread messages
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    p_user_id,
    'message',
    'Nuevo mensaje',
    COALESCE(p.full_name, 'Usuario') || ': ' || latest.content,
    jsonb_build_object(
      'conversation_id', c.id,
      'unread_count', sub.unread_count
    )
  FROM (
    SELECT c.id, COUNT(*) AS unread_count
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE m.sender_id != p_user_id
      AND NOT (c.archived_by @> ARRAY[p_user_id])
      AND (
        (c.user1_id = p_user_id
          AND m.created_at > COALESCE(c.user1_last_read_at, '1970-01-01'::timestamptz))
        OR
        (c.user2_id = p_user_id
          AND m.created_at > COALESCE(c.user2_last_read_at, '1970-01-01'::timestamptz))
      )
    GROUP BY c.id
  ) sub
  JOIN conversations c ON c.id = sub.id
  -- Latest message for preview
  LEFT JOIN LATERAL (
    SELECT content, sender_id FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC LIMIT 1
  ) latest ON true
  -- Sender name
  LEFT JOIN profiles p ON p.id = latest.sender_id;
END;
$$;
