import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';

interface MessagesPage {
  items: Message[];
  nextCursor: { created_at: string; id: string } | null;
}

export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery<MessagesPage>({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }) => {
      if (!conversationId) return { items: [], nextCursor: null };

      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(50 + 1);

      if (pageParam) {
        const cursor = pageParam as { created_at: string; id: string };
        query = query.or(
          `and(created_at.lt.${cursor.created_at}),and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        );
      }

      const { data } = await query;

      if (!data || data.length === 0) return { items: [], nextCursor: null };

      const hasMore = data.length > 50;
      const items = hasMore ? data.slice(0, 50) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { created_at: lastItem.created_at, id: lastItem.id }
        : null;

      // Reverse to show oldest first (we fetched newest first for cursor)
      const reversed = [...items].reverse() as Message[];
      const senderIds = [...new Set(reversed.map((m) => m.sender_id))];

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', senderIds);
        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        return {
          items: reversed.map((m) => ({
            ...m,
            sender: profileMap.get(m.sender_id),
          })) as Message[],
          nextCursor,
        };
      }

      return { items: reversed, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
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

      // Snapshot anterior para rollback (formato infinite query)
      const previous = queryClient.getQueryData([
        'messages',
        conversationId,
      ]);

      // Insert optimista — append to last page (newest messages)
      queryClient.setQueryData(
        ['messages', conversationId],
        (old: any) => {
          if (!old || !old.pages || old.pages.length === 0) {
            return {
              pages: [{
                items: [{
                  id: `temp-${Date.now()}`,
                  conversation_id: conversationId,
                  sender_id: senderId,
                  content,
                  created_at: new Date().toISOString(),
                }],
                nextCursor: null,
              }],
              pageParams: [null],
            };
          }
          const lastPage = old.pages[old.pages.length - 1];
          return {
            ...old,
            pages: [
              ...old.pages.slice(0, -1),
              {
                ...lastPage,
                items: [
                  ...lastPage.items,
                  {
                    id: `temp-${Date.now()}`,
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            ],
          };
        },
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
