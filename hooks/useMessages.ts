import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';
import { useBlockedUserIds } from '@/hooks/useBlockedUserIds';

/**
 * Stable empty array used as the blockedIds default while the query is
 * loading/disabled: a fresh `[]` literal per render would give the
 * `useMemo` below a new dependency identity every render (churn).
 */
const EMPTY_BLOCKED_IDS: string[] = [];

interface MessagesPage {
  items: Message[];
  nextCursor: { created_at: string; id: string } | null;
}

export function useMessages(conversationId: string | undefined) {
  // Defensive client-side filter: messages from a blocked sender never reach
  // the UI. Cursor/pagination logic stays untouched (computed on the raw
  // rows); only the final array is filtered.
  const { data: blockedIds = EMPTY_BLOCKED_IDS } = useBlockedUserIds();
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);

  const query = useInfiniteQuery<MessagesPage>({
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
          items: reversed
            .map((m) => ({
              ...m,
              sender: profileMap.get(m.sender_id),
            }))
            .filter((m) => !blocked.has(m.sender_id)) as Message[],
          nextCursor,
        };
      }

      return {
        items: reversed.filter((m) => !blocked.has(m.sender_id)),
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    enabled: !!conversationId,
    staleTime: 30_000,
  });

  // Render-time filter override on the returned data (same pattern as
  // useListingsInfinite): the queryFn filter only applies at fetch time, so
  // cached/realtime content from blocked senders could stay visible while
  // blockedIds changes after mount (e.g. opening a chat with an already
  // blocked user before the blocked list resolves). Re-filtering at render
  // time keeps the UI consistent with the current blocked set.
  const data = useMemo(() => {
    if (!query.data) return query.data;
    return {
      ...query.data,
      pages: query.data.pages.map((page) => ({
        ...page,
        items: page.items.filter((m) => !blocked.has(m.sender_id)),
      })),
    };
  }, [query.data, blocked]);

  // W1: auto-advance failure guard — the auto-advance effect below stops
  // fetching after a page fetch error instead of looping forever.
  const advanceErrorRef = useRef(false);
  const lastSuccessAtRef = useRef(query.dataUpdatedAt);

  // Auto-advance through fully-filtered pages: when the last fetched page
  // has zero VISIBLE messages (all from blocked senders), keep fetching
  // until visible content appears or the raw dataset ends. Without it, a
  // conversation whose newest pages are entirely from blocked senders would
  // render the "Inicia la conversacion" empty state forever — and an empty
  // list has no scroll surface, so the chat's onScroll loader can never
  // fire to reach the user's own older messages past the block. Cannot
  // infinite-loop: hasNextPage goes false when raw pages run out, and
  // isFetchingNextPage prevents concurrent fetches. We only advance on an
  // EMPTY visible page, so pages that render content are never auto-fetched.
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
    // context, so a retry may now succeed (e.g. the sender got unblocked).
    advanceErrorRef.current = false;
  }, [blocked]);

  return { ...query, data };
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
