import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Ids of the users the current user has blocked, from the shared
 * `user_blocks` table (created in the web repo migration on the shared
 * database — the client only reads it at runtime, no local migration).
 *
 * Consumed by useListings / useListingsInfinite / useConversations /
 * useMessages and by the report/block UI to flip the "blocked" state.
 */
export function useBlockedUserIds() {
  const { user } = useAuth();

  return useQuery<string[]>({
    queryKey: ['user_blocks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      if (error) throw error;
      return (data || []).map((row: { blocked_id: string }) => row.blocked_id);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
