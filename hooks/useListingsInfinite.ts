import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types';
import { useBlockedUserIds } from '@/hooks/useBlockedUserIds';

/**
 * Stable empty array used as the blockedIds default while the query is
 * loading/disabled: a fresh `[]` literal per render would give the
 * `useMemo` below a new dependency identity every render (churn).
 */
const EMPTY_BLOCKED_IDS: string[] = [];

export interface ExploreFilters {
  query?: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  filter: 'all' | 'featured' | 'recent';
  sortBy: 'recent' | 'price_asc' | 'price_desc';
}

const PAGE_SIZE = 20;

export function useListingsInfinite(filters: ExploreFilters) {
  // Use GIN-indexed RPC for text search (O(log n) vs O(n) ilike scan)
  const isSearchMode = !!filters.query;

  // Hide listings from blocked users. The server RPC path (search_listings)
  // already filters server-side once the web migration lands; filtering the
  // final arrays client-side too is harmless and keeps both paths consistent.
  const { data: blockedIds = EMPTY_BLOCKED_IDS } = useBlockedUserIds();
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);

  const query = useInfiniteQuery({
    placeholderData: keepPreviousData,
    queryKey: ['listings', 'explore', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;

      if (isSearchMode) {
        // search_listings (migración 20260718000007, definida en el repo web)
        // ya filtra por rango de precio y ubicación (ILIKE parcial) — mismos
        // parámetros que la web
        const { data, error } = await supabase.rpc('search_listings', {
          p_query: filters.query!,
          p_category_id: filters.categoryId ?? null,
          p_price_min: filters.priceMin ?? null,
          p_price_max: filters.priceMax ?? null,
          p_location: filters.location ?? null,
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

      // Mismo patrón que buildBaseQuery en la web: rango de precio y ubicación
      if (filters.priceMin !== undefined) {
        query = query.gte('price', filters.priceMin);
      }
      if (filters.priceMax !== undefined) {
        query = query.lte('price', filters.priceMax);
      }
      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
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
    getNextPageParam: (lastPage: { data: Listing[]; nextPage: number | null }) => {
      // Pagination is driven by RAW (pre-filter) rows, exactly as if there
      // were no block filter: hasNextPage stays true while raw pages exist.
      // A fully-blocked page must NOT stop onEndReached — legit listings
      // past it would become unreachable. Empty visible pages are skipped
      // by the auto-advance effect below, which terminates when the raw
      // dataset ends (hasNextPage goes false).
      return lastPage.nextPage;
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  const data = useMemo(() => {
    if (!query.data) return query.data;
    return {
      ...query.data,
      pages: query.data.pages.map((page) => ({
        ...page,
        data: page.data.filter((listing) => !blocked.has(listing.user_id)),
      })),
    };
  }, [query.data, blocked]);

  // W1: auto-advance failure guard — the auto-advance effect below stops
  // fetching after a page fetch error instead of looping forever.
  const advanceErrorRef = useRef(false);
  const lastSuccessAtRef = useRef(query.dataUpdatedAt);

  // Auto-advance through fully-filtered pages: when the last fetched page
  // has zero VISIBLE rows (all blocked out), keep fetching until visible
  // content appears or the raw dataset ends. Cannot infinite-loop:
  // hasNextPage goes false when raw pages run out, and isFetchingNextPage
  // prevents concurrent fetches. We only advance on an EMPTY visible page,
  // so pages that render content are never auto-fetched.
  const lastVisiblePage = data?.pages[data.pages.length - 1]?.data ?? [];
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
    // context, so a retry may now succeed (e.g. the seller got unblocked).
    advanceErrorRef.current = false;
  }, [blocked]);

  return { ...query, data };
}
