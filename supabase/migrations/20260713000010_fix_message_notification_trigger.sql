-- Fix fn_create_message_notification: profiles has full_name, not display_name.
-- Same bug that was fixed in fn_create_review_notification (migration 00002)
-- but this function was created in migration 00003 and the display_name
-- reference was never corrected.
--
-- When this trigger failed (column "display_name" does not exist), the entire
-- message INSERT was rolled back, causing the optimistic update in the client
-- to be reverted — the message appeared for a second and then disappeared.

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

  -- Nombre del que envía (profiles only has full_name, not display_name)
  SELECT COALESCE(NULLIF(full_name, ''), 'Usuario')
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
