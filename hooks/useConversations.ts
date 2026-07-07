import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Conversation, Message } from '@/types';

export function useConversations(userId: string | undefined) {
  return useQuery<Conversation[]>({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data } = await supabase
        .from('conversations')
        .select('*, listing:listing_id(*)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .not('archived_by', 'cs', `{${userId}}`)
        .order('last_message_at', { ascending: false });

      if (!data) return [];

      // Perfiles de los otros usuarios
      const otherIds = data.map((c) =>
        c.user1_id === userId ? c.user2_id : c.user1_id,
      );
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const convs: Conversation[] = data.map((c) => {
        const otherId =
          c.user1_id === userId ? c.user2_id : c.user1_id;
        return {
          ...c,
          other_user: profileMap.get(otherId) || null,
        } as unknown as Conversation;
      });

      // Último mensaje de cada conversación
      const ids = convs.map((c) => c.id);
      if (ids.length > 0) {
        const lastMessages = await Promise.all(
          ids.map(async (convId) => {
            const { data } = await supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', convId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            return data ? (data as Message) : undefined;
          }),
        );
        convs.forEach((c, i) => {
          c.last_message = lastMessages[i];
        });
      }

      return convs;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      const { error } = await supabase.rpc('archive_conversation', {
        conv_id: conversationId,
        user_id: userId,
      });
      if (error) throw error;
    },
    onMutate: async ({ conversationId, userId }) => {
      // Cancelar refetches para no pisar el optimistimo
      await queryClient.cancelQueries({
        queryKey: ['conversations', userId],
      });

      // Snapshot del estado anterior para rollback
      const previous = queryClient.getQueryData<Conversation[]>([
        'conversations',
        userId,
      ]);

      // Remover la conversación del caché al toque
      queryClient.setQueryData<Conversation[]>(
        ['conversations', userId],
        (old) => old?.filter((c) => c.id !== conversationId) || [],
      );

      return { previous, userId };
    },
    onError: (_err, _vars, context) => {
      // Restaurar si falló
      if (context?.previous && context?.userId) {
        queryClient.setQueryData(
          ['conversations', context.userId],
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['conversations', vars.userId],
      });
    },
  });
}
