-- Soft delete para conversaciones: cada usuario puede archivar una conversación
-- sin afectar al otro participante.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS archived_by uuid[] DEFAULT '{}';

-- Función segura para archivar: appendea el user_id al array evitando race conditions
CREATE OR REPLACE FUNCTION archive_conversation(conv_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversations
  SET archived_by = array_append(COALESCE(archived_by, '{}'), user_id)
  WHERE id = conv_id
    AND (user1_id = user_id OR user2_id = user_id);
END;
$$;

-- Política UPDATE que faltaba (los participantes pueden modificar la conversación)
-- Esto también habilita el update de last_message_at que antes fallaba silenciosamente
DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;
CREATE POLICY "conversations_update_participant" ON conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
