import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface FeaturedRemainingState {
  remaining: number;
  maxFeatured: number;
  featuredUsed: number;
  loading: boolean;
  error: string | null;
}

export function useFeaturedRemaining() {
  const { user } = useAuth();
  const [state, setState] = useState<FeaturedRemainingState>({
    remaining: 0,
    maxFeatured: 0,
    featuredUsed: 0,
    loading: true,
    error: null,
  });

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setState({
        remaining: 0,
        maxFeatured: 0,
        featuredUsed: 0,
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        'featured_used, period_start, plan:plan_id(max_featured, featured_duration_days)',
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      return;
    }

    if (!data || !data.plan || !data.plan[0]) {
      setState({
        remaining: 0,
        maxFeatured: 0,
        featuredUsed: 0,
        loading: false,
        error: null,
      });
      return;
    }

    const planInfo = data.plan[0];
    const maxFeatured = planInfo.max_featured;
    let featuredUsed = data.featured_used;

    // Auto-reset if period expired (same logic as the RPC)
    const periodStart = new Date(data.period_start);
    const durationDays = planInfo.featured_duration_days;
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + durationDays);

    if (new Date() > periodEnd) {
      featuredUsed = 0;
    }

    setState({
      remaining: maxFeatured - featuredUsed,
      maxFeatured,
      featuredUsed,
      loading: false,
      error: null,
    });
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return { ...state, refetch: fetchUsage };
}
