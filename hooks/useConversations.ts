import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Conversation, Message } from '@/types';

const CONV_PAGE_SIZE = 30;

interface ConversationsPage {
  items: Conversation[];
  nextCursor: { last_message_at: string; id: string } | null;
}

export function useConversations(userId: string | undefined) {
  return useInfiniteQuery<ConversationsPage>({
    queryKey: ['conversations', userId],
    queryFn: async ({ pageParam }) => {
      if (!userId) return { items: [], nextCursor: null };

      let query = supabase
        .from('conversations')
        .select('*, listing:listing_id(id, title, price, images)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .not('archived_by', 'cs', `{${userId}}`)
        .order('last_message_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(CONV_PAGE_SIZE + 1);

      if (pageParam) {
        const cursor = pageParam as { last_message_at: string; id: string };
        query = query.or(
          `and(last_message_at.lt.${cursor.last_message_at}),and(last_message_at.eq.${cursor.last_message_at},id.lt.${cursor.id})`
        );
      }

      const { data } = await query;

      if (!data || data.length === 0) return { items: [], nextCursor: null };

      const hasMore = data.length > CONV_PAGE_SIZE;
      const items = hasMore ? data.slice(0, CONV_PAGE_SIZE) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { last_message_at: lastItem.last_message_at, id: lastItem.id }
        : null;

      // Batch-fetch profiles + last messages + unread messages
      const otherIds = items.map((c) => c.user1_id === userId ? c.user2_id : c.user1_id);
      const convIds = items.map((c) => c.id);

      const [profilesRes, lastMsgsRes, unreadMsgsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', otherIds),
        convIds.length > 0
          ? supabase
              .from('messages')
              .select('*')
              .in('conversation_id', convIds)
              .order('created_at', { ascending: false })
              .limit(100)
          : { data: [], error: null },
        convIds.length > 0
          ? supabase
              .from('messages')
              .select('conversation_id, created_at, sender_id')
              .in('conversation_id', convIds)
              .neq('sender_id', userId)
          : { data: [], error: null },
      ]);

      // Log errors but don't crash — degrade gracefully
      if (profilesRes.error) console.error('useConversations: profiles error', profilesRes.error.message);
      if (lastMsgsRes.error) console.error('useConversations: lastMsgs error', lastMsgsRes.error.message);
      if (unreadMsgsRes.error) console.error('useConversations: unreadMsgs error', unreadMsgsRes.error.message);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));

      const lastMsgByConv = new Map<string, Message>();
      for (const msg of (lastMsgsRes.data || []) as Message[]) {
        if (!lastMsgByConv.has(msg.conversation_id)) {
          lastMsgByConv.set(msg.conversation_id, msg as Message);
        }
      }

      const unreadMsgs = (unreadMsgsRes.data || []) as { conversation_id: string; created_at: string; sender_id: string }[];
      const unreadByConv = new Map<string, number>();
      for (const msg of unreadMsgs) {
        const conv = items.find((c) => c.id === msg.conversation_id);
        if (!conv) continue;
        const lastReadAt = conv.user1_id === userId
          ? conv.user1_last_read_at
          : conv.user2_last_read_at;
        if (!lastReadAt || msg.created_at > lastReadAt) {
          unreadByConv.set(msg.conversation_id, (unreadByConv.get(msg.conversation_id) || 0) + 1);
        }
      }

      return {
        items: items.map((c) => ({
          ...c,
          other_user: profileMap.get(c.user1_id === userId ? c.user2_id : c.user1_id) || null,
          last_message: lastMsgByConv.get(c.id),
          unread_count: unreadByConv.get(c.id) || 0,
        })) as Conversation[],
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
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

      // Snapshot del estado anterior para rollback (formato infinite query)
      const previous = queryClient.getQueryData([
        'conversations',
        userId,
      ]);

      // Remover la conversación del caché al toque
      queryClient.setQueryData(
        ['conversations', userId],
        (old: any) => {
          if (!old || !old.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.filter((c: Conversation) => c.id !== conversationId),
            })),
          };
        },
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
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}
