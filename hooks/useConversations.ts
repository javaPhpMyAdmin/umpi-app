import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Conversation, Message } from '@/types';
import { useBlockedUserIds } from '@/hooks/useBlockedUserIds';

const CONV_PAGE_SIZE = 30;

/**
 * Stable empty array used as the blockedIds default while the query is
 * loading/disabled: a fresh `[]` literal per render would give the
 * `useMemo` below a new dependency identity every render (churn).
 */
const EMPTY_BLOCKED_IDS: string[] = [];

interface ConversationsPage {
  items: Conversation[];
  nextCursor: { last_message_at: string; id: string } | null;
}

export function useConversations(userId: string | undefined) {
  // Conversations with a blocked other-user are hidden client-side. The list
  // is captured from the hook (static per user) and re-invalidated by the
  // block/unblock mutations, so no query-key changes are needed.
  const { data: blockedIds = EMPTY_BLOCKED_IDS } = useBlockedUserIds();
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);

  const query = useInfiniteQuery<ConversationsPage>({
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
      const rawItems = hasMore ? data.slice(0, CONV_PAGE_SIZE) : data;

      // Cursor from the RAW last row (pre-filter): pagination is driven by
      // raw rows exactly as if there were no block filter — hasNextPage
      // stays true while raw batches exist. A fully-blocked batch must not
      // null the cursor (legit conversations past it would be unreachable);
      // the auto-advance effect below skips empty visible pages and
      // terminates when the raw dataset ends.
      const lastRaw = rawItems[rawItems.length - 1];
      const nextCursor = hasMore && lastRaw
        ? { last_message_at: lastRaw.last_message_at, id: lastRaw.id }
        : null;

      // Drop conversations where the other user is blocked — filtered before
      // the batch fetch so we don't pull profiles/messages for them.
      const visibleItems = rawItems.filter((c) => {
        const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;
        return !blocked.has(otherId);
      });

      // Batch-fetch profiles + last messages + unread messages
      const otherIds = visibleItems.map((c) => c.user1_id === userId ? c.user2_id : c.user1_id);
      const convIds = visibleItems.map((c) => c.id);

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
        const conv = visibleItems.find((c) => c.id === msg.conversation_id);
        if (!conv) continue;
        const lastReadAt = conv.user1_id === userId
          ? conv.user1_last_read_at
          : conv.user2_last_read_at;
        if (!lastReadAt || msg.created_at > lastReadAt) {
          unreadByConv.set(msg.conversation_id, (unreadByConv.get(msg.conversation_id) || 0) + 1);
        }
      }

      return {
        items: visibleItems.map((c) => ({
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

  // Render-time filter override on the returned data (same pattern as
  // useListingsInfinite): the queryFn filter only applies at fetch time, so
  // cached/realtime content from blocked users could stay visible while
  // blockedIds changes after mount. Re-filtering at render time keeps the
  // UI consistent with the current blocked set.
  const data = useMemo(() => {
    if (!query.data || !userId) return query.data;
    return {
      ...query.data,
      pages: query.data.pages.map((page) => ({
        ...page,
        items: page.items.filter((c) => {
          const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;
          return !blocked.has(otherId);
        }),
      })),
    };
  }, [query.data, blocked, userId]);

  // W1: auto-advance failure guard — the auto-advance effect below stops
  // fetching after a page fetch error instead of looping forever.
  const advanceErrorRef = useRef(false);
  const lastSuccessAtRef = useRef(query.dataUpdatedAt);

  // Auto-advance through fully-filtered pages: when the last fetched batch
  // has zero VISIBLE conversations (all blocked out), keep fetching until
  // visible content appears or the raw dataset ends. Cannot infinite-loop:
  // hasNextPage goes false when raw batches run out, and isFetchingNextPage
  // prevents concurrent fetches. We only advance on an EMPTY visible page,
  // so batches that render content are never auto-fetched.
  const lastVisiblePage = data?.pages[data.pages.length - 1]?.items ?? [];
  useEffect(() => {
    // W1 failure guard: if a page fetch rejects, hasNextPage stays true,
    // isFetchingNextPage goes false and the last visible page is still
    // empty → the effect would re-fire forever, hammering the server with
    // error retries. Record the failure and stop; the guard is released
    // below on the next successful fetch or when the blocked list changes.
    if (advanceErrorRef.current) return;
    if (!query.hasNextPage || query.isFetchingNextPage || lastVisiblePage.length > 0) return;
    // .catch() also avoids an unhandled rejection on the returned promise
    // (cancellations reject with CancelledError too and self-heal below).
    query.fetchNextPage().catch(() => {
      advanceErrorRef.current = true;
    });
  }, [query.hasNextPage, query.isFetchingNextPage, lastVisiblePage.length, query.fetchNextPage]);

  useEffect(() => {
    // Release the failure guard on any successful fetch: dataUpdatedAt only
    // advances when a fetch lands new data (manual refetch, refetch after
    // block/unblock, or a later auto-advance page fetch), so transient
    // errors do not disable auto-advance forever.
    if (query.dataUpdatedAt !== lastSuccessAtRef.current) {
      lastSuccessAtRef.current = query.dataUpdatedAt;
      advanceErrorRef.current = false;
    }
  }, [query.dataUpdatedAt]);

  useEffect(() => {
    // Release the failure guard when the blocked list changes: new filter
    // context, so a retry may now succeed (e.g. the other user got
    // unblocked).
    advanceErrorRef.current = false;
  }, [blocked]);

  return { ...query, data };
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
