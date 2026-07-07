import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';

export function useMessages(conversationId: string | undefined) {
  return useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!data) return [];

      const msgs = data as Message[];
      const senderIds = [...new Set(msgs.map((m) => m.sender_id))];

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', senderIds);
        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        return msgs.map((m) => ({
          ...m,
          sender: profileMap.get(m.sender_id),
        })) as Message[];
      }

      return msgs;
    },
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      senderId,
    }: {
      conversationId: string;
      content: string;
      senderId: string;
    }) => {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    },
    onMutate: async ({ conversationId, content, senderId }) => {
      // Cancelar refetches en vuelo para no pisar el optimistimo
      await queryClient.cancelQueries({
        queryKey: ['messages', conversationId],
      });

      // Snapshot anterior para rollback
      const previous = queryClient.getQueryData<Message[]>([
        'messages',
        conversationId,
      ]);

      // Insert optimista
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId],
        (old) => [
          ...(old || []),
          {
            id: `temp-${Date.now()}`,
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            created_at: new Date().toISOString(),
          } as Message,
        ],
      );

      return { previous, conversationId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context?.conversationId) {
        queryClient.setQueryData(
          ['messages', context.conversationId],
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['messages', vars.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
