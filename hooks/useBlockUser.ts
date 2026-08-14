import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Blocks a user by inserting a row into `user_blocks` (shared DB, web repo
 * migration). The blocker is always the signed-in user; RLS on the shared
 * table enforces `blocker_id = auth.uid()`.
 *
 * The blocked list is optimistically updated and every query that renders
 * content from other users (listings, explore, conversations, messages,
 * unread counts) is invalidated so blocked users disappear client-side
 * without waiting for a refetch.
 */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Debes iniciar sesión');
      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: blockedId });
      if (error) throw error;
    },
    onMutate: async (blockedId: string) => {
      // mutationFn throws without a user, but onMutate runs first — skip the
      // optimistic write so we don't seed a ghost ['user_blocks', undefined]
      // cache entry.
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['user_blocks', user?.id] });
      const previous = queryClient.getQueryData<string[]>(['user_blocks', user?.id]);
      queryClient.setQueryData<string[]>(['user_blocks', user?.id], (old) => {
        const base = old || [];
        return base.includes(blockedId) ? base : [...base, blockedId];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['user_blocks', user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user_blocks', user?.id] });
      // Content queries that must hide blocked users.
      queryClient.invalidateQueries({ queryKey: ['listings'] }); // home + explore
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}
