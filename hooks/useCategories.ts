import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60_000, // 5 min — cambian poco
  });
}
