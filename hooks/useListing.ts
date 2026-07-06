import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types';

export function useListing(id: string | null) {
  return useQuery<Listing | null>({
    queryKey: ['listing', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('listings')
        .select('*, category:category_id(*)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as Listing | null;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
