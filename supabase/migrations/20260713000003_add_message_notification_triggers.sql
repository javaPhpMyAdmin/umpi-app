/*
# Message notification triggers (replace polling)

Elimina la necesidad del polling cada 30s mediante triggers:

1. `fn_create_message_notification()` — al INSERT en `messages`, crea o
   actualiza la notificación para el receptor
2. `fn_mark_message_notification_read()` — al UPDATE en `conversations`
   (userX_last_read_at), marca la notificación como leída

Así no más sync_message_notifications cada 30s para todos los usuarios activos.
*/

-- ==========================================
-- 1. Trigger: crear/actualizar notificación al recibir mensaje
-- ==========================================

CREATE OR REPLACE FUNCTION fn_create_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_receiver_id uuid;
  v_sender_name text;
  v_existing_id uuid;
BEGIN
  -- No te notifiques a vos mismo
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Encontrar al receptor
  SELECT CASE WHEN user1_id = NEW.sender_id THEN user2_id ELSE user1_id END
  INTO v_receiver_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nombre del que envía
  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(full_name, ''), 'Usuario')
  INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Si ya hay una notificación NO LEÍDA para esta conversación, actualizarla
  SELECT id INTO v_existing_id
  FROM public.notifications
  WHERE user_id = v_receiver_id
    AND type = 'message'
    AND is_read = false
    AND data->>'conversation_id' = NEW.conversation_id::text;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.notifications
    SET body = v_sender_name || ': ' || LEFT(NEW.content, 150),
        created_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_receiver_id,
      'message',
      'Nuevo mensaje',
      v_sender_name || ': ' || LEFT(NEW.content, 150),
      jsonb_build_object('conversation_id', NEW.conversation_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to messages table
DROP TRIGGER IF EXISTS trg_create_message_notification ON public.messages;
CREATE TRIGGER trg_create_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION fn_create_message_notification();

-- ==========================================
-- 2. Trigger: marcar notificación como leída cuando se lee la conversación
-- ==========================================

CREATE OR REPLACE FUNCTION fn_mark_message_notification_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Se actualizó user1_last_read_at?
  IF NEW.user1_last_read_at IS DISTINCT FROM OLD.user1_last_read_at THEN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = NEW.user1_id
      AND type = 'message'
      AND is_read = false
      AND data->>'conversation_id' = NEW.id::text;
  END IF;

  -- Se actualizó user2_last_read_at?
  IF NEW.user2_last_read_at IS DISTINCT FROM OLD.user2_last_read_at THEN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = NEW.user2_id
      AND type = 'message'
      AND is_read = false
      AND data->>'conversation_id' = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to conversations table
DROP TRIGGER IF EXISTS trg_mark_message_notification_read ON public.conversations;
CREATE TRIGGER trg_mark_message_notification_read
AFTER UPDATE OF user1_last_read_at, user2_last_read_at ON public.conversations
FOR EACH ROW EXECUTE FUNCTION fn_mark_message_notification_read();
