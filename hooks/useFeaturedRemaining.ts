import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface FeaturedRemaining {
  remaining: number;
  maxFeatured: number;
  activeFeatured: number;
}

async function fetchFeaturedRemaining(userId: string): Promise<FeaturedRemaining> {
  const [{ data: subData, error: subError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from('subscriptions')
        .select('plan:plan_id(max_featured)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_featured', true),
    ]);

  if (subError) throw subError;
  if (countError) throw countError;

  const maxFeatured = subData?.plan?.[0]?.max_featured ?? 0;
  const activeFeatured = count ?? 0;

  return {
    remaining: Math.max(0, maxFeatured - activeFeatured),
    maxFeatured,
    activeFeatured,
  };
}

export function useFeaturedRemaining() {
  const { user } = useAuth();

  return useQuery<FeaturedRemaining>({
    queryKey: ['featured-remaining', user?.id],
    queryFn: () => fetchFeaturedRemaining(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
