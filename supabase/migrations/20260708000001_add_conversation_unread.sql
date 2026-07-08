-- Track cuando cada usuario leyó por última vez cada conversación
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user1_last_read_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user2_last_read_at timestamptz DEFAULT now();

-- RPC seguro para marcar como leído: actualiza la columna correspondiente
-- según qué slot (user1 o user2) ocupa el usuario actual
CREATE OR REPLACE FUNCTION mark_conversation_read(conv_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversations
  SET
    user1_last_read_at = CASE WHEN user1_id = p_user_id THEN now() ELSE user1_last_read_at END,
    user2_last_read_at = CASE WHEN user2_id = p_user_id THEN now() ELSE user2_last_read_at END
  WHERE id = conv_id AND (user1_id = p_user_id OR user2_id = p_user_id);
END;
$$;

-- RPC: total de mensajes no leídos para un usuario (para el badge del tab)
CREATE OR REPLACE FUNCTION get_total_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total bigint;
BEGIN
  SELECT COALESCE(SUM(cnt), 0) INTO total
  FROM (
    SELECT COUNT(*) AS cnt
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE m.sender_id != p_user_id
      AND NOT (c.archived_by @> ARRAY[p_user_id])
      AND (
        (c.user1_id = p_user_id AND m.created_at > COALESCE(c.user1_last_read_at, '1970-01-01'::timestamptz))
        OR
        (c.user2_id = p_user_id AND m.created_at > COALESCE(c.user2_last_read_at, '1970-01-01'::timestamptz))
      )
    GROUP BY c.id
  ) sub;

  RETURN total;
END;
$$;
