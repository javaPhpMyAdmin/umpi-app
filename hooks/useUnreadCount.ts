import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useUnreadCount(userId: string | undefined) {
  return useQuery<number>({
    queryKey: ['unreadCount', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data, error } = await supabase.rpc('get_total_unread_count', {
        p_user_id: userId,
      });
      if (error) return 0;
      return (data as number) ?? 0;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
