-- RPC para crear conversación + primer mensaje en una sola transacción.
-- Si el mensaje falla, la conversación no se crea (sin huérfanas).
--
-- Seguridad: SECURITY DEFINER porque el INSERT en messages necesita el id
-- de la conversación que acabamos de insertar (no se puede con RLS en dos pasos
-- atómicos desde el cliente). La función verifica que el usuario autenticado
-- sea uno de los participantes.

CREATE OR REPLACE FUNCTION create_conversation_with_message(
  p_listing_id uuid,
  p_user1_id uuid,
  p_user2_id uuid,
  p_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conversation_id uuid;
  v_listing_exists boolean;
BEGIN
  -- Verificar que el usuario autenticado sea uno de los participantes
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF auth.uid() != p_user1_id AND auth.uid() != p_user2_id THEN
    RAISE EXCEPTION 'No sos parte de esta conversación';
  END IF;

  -- Verificar que el listing existe (opcional, pero evita conversaciones a listings inexistentes)
  SELECT EXISTS(SELECT 1 FROM public.listings WHERE id = p_listing_id)
  INTO v_listing_exists;

  IF NOT v_listing_exists THEN
    RAISE EXCEPTION 'El aviso no existe';
  END IF;

  -- Insertar conversación
  INSERT INTO public.conversations (listing_id, user1_id, user2_id)
  VALUES (p_listing_id, p_user1_id, p_user2_id)
  RETURNING id INTO v_conversation_id;

  -- Insertar mensaje (usando el ID de la conversación recién creada)
  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (v_conversation_id, auth.uid(), p_content);

  -- Actualizar last_message_at
  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = v_conversation_id;

  -- Devolver el ID de la conversación
  RETURN jsonb_build_object('conversation_id', v_conversation_id);
END;
$$;
