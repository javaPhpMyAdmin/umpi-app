import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ReviewDisplay {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
}

export function useListingReviews(listingId: string | undefined) {
  return useQuery<ReviewDisplay[]>({
    queryKey: ['listing-reviews', listingId],
    queryFn: async () => {
      if (!listingId) return [];

      // 1. Fetch reviews for this listing
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer_id')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;
      if (!reviews || reviews.length === 0) return [];

      // 2. Fetch reviewer profiles separately (avoids PostgREST FK embedding)
      const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', reviewerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      // 3. Merge
      return reviews.map((r) => {
        const profile = profileMap.get(r.reviewer_id);
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewer_name: profile?.full_name ?? 'Usuario',
          reviewer_avatar: profile?.avatar_url ?? null,
        };
      });
    },
    enabled: !!listingId,
    staleTime: 30_000,
    retry: 2,
  });
}
