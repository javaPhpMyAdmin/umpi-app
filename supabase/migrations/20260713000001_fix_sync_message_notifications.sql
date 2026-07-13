-- Fix sync_message_notifications: schema-qualify table references.
-- The original had SET search_path = '' but referenced tables (notifications,
-- conversations, messages, profiles) without the public schema prefix,
-- causing "relation does not exist" errors.
--
-- V2: Only remove UNREAD message notifications (keep read ones so they
-- stay visible in the notification list as grayed/read). Also guard the
-- INSERT with NOT EXISTS to avoid duplicate unread notifications for the
-- same conversation.

CREATE OR REPLACE FUNCTION sync_message_notifications(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Remove stale UNREAD message notifications only (keep read ones for history)
  DELETE FROM public.notifications
  WHERE user_id = p_user_id AND type = 'message' AND is_read = false;

  -- Insert one notification per conversation with unread messages
  INSERT INTO public.notifications (user_id, type, title, body, data)
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
    FROM public.conversations c
    JOIN public.messages m ON m.conversation_id = c.id
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
  JOIN public.conversations c ON c.id = sub.id
  -- Latest message for preview
  LEFT JOIN LATERAL (
    SELECT content, sender_id FROM public.messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC LIMIT 1
  ) latest ON true
  -- Sender name
  LEFT JOIN public.profiles p ON p.id = latest.sender_id
  -- Avoid duplicate unread notification for the same conversation
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.type = 'message'
      AND n.is_read = false
      AND n.data->>'conversation_id' = c.id::text
  );
END;
$$;
