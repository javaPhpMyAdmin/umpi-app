import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Unblocks a user by deleting the matching `user_blocks` row (shared DB,
 * web repo migration). Optimistic mirror of useBlockUser: the blocked list
 * is updated in place and the content queries are re-invalidated.
 */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Debes iniciar sesión');
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onMutate: async (blockedId: string) => {
      // mutationFn throws without a user, but onMutate runs first — skip the
      // optimistic write so we don't seed a ghost ['user_blocks', undefined]
      // cache entry.
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['user_blocks', user?.id] });
      const previous = queryClient.getQueryData<string[]>(['user_blocks', user?.id]);
      queryClient.setQueryData<string[]>(['user_blocks', user?.id], (old) =>
        (old || []).filter((id) => id !== blockedId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['user_blocks', user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user_blocks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}
