import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types';

export interface ExploreFilters {
  query?: string;
  categoryId?: string;
  filter: 'all' | 'featured' | 'recent';
  sortBy: 'recent' | 'price_asc' | 'price_desc';
}

const PAGE_SIZE = 20;

export function useListingsInfinite(filters: ExploreFilters) {
  // Use GIN-indexed RPC for text search (O(log n) vs O(n) ilike scan)
  const isSearchMode = !!filters.query;

  return useInfiniteQuery({
    placeholderData: keepPreviousData,
    queryKey: ['listings', 'explore', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;

      if (isSearchMode) {
        const { data, error } = await supabase.rpc('search_listings', {
          p_query: filters.query!,
          p_category_id: filters.categoryId ?? null,
          p_location: null,
          p_limit: PAGE_SIZE,
          p_offset: offset,
        });

        if (error) throw error;

        const rows = (data || []) as Listing[];
        return {
          data: rows,
          nextPage: rows.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
        };
      }

      // Non-search: standard offset query
      let query = supabase
        .from('listings')
        .select('*, category:category_id(*), city:city_id(*)')
        .eq('status', 'active')
        .range(offset, offset + PAGE_SIZE - 1);

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.filter === 'featured') {
        query = query.eq('is_featured', true);
      } else if (filters.filter === 'recent') {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);
        query = query.gte('created_at', recentDate.toISOString());
      }

      switch (filters.sortBy) {
        case 'price_asc':
          query = query.order('price', { ascending: true });
          query = query.order('created_at', { ascending: false });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          query = query.order('created_at', { ascending: false });
          break;
        case 'recent':
        default:
          query = query.order('listing_priority', { ascending: false });
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;

      const rows = (data || []) as Listing[];
      return {
        data: rows,
        nextPage: rows.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage: { data: Listing[]; nextPage: number | null }) =>
      lastPage.nextPage,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}
