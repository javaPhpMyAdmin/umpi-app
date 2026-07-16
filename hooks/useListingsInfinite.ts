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
  return useInfiniteQuery({
    placeholderData: keepPreviousData,
    queryKey: ['listings', 'explore', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      let query = supabase
        .from('listings')
        .select('*, category:category_id(*), city:city_id(*)')
        .eq('status', 'active')
        .range(offset, offset + PAGE_SIZE - 1);

      // Filtro por categoría (server-side)
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      // Búsqueda por texto en título y descripción (server-side)
      if (filters.query) {
        query = query.or(
          `title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`,
        );
      }

      // Filtros de tipo: destacados (featured) / recientes (últimos 7 días)
      if (filters.filter === 'featured') {
        query = query.eq('is_featured', true);
      } else if (filters.filter === 'recent') {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);
        query = query.gte('created_at', recentDate.toISOString());
      }

      // Orden: el sortBy del usuario controla el criterio PRIMARIO
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
          // Featured primero por prioridad, después los más nuevos
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
    // Mantener pages en caché 5 min: si cambiás de filtro y volvés, TanStack
    // sirve los datos cacheados + revalidación bg. El keepPreviousData hace que
    // el switch sea instantáneo, gcTime evita que se descarten al desmontarse.
    gcTime: 5 * 60 * 1000,
  });
}
