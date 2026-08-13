import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SubscriptionPlan } from '@/types';

/**
 * Lee los planes activos de `subscription_plans` — única fuente de verdad
 * para precios y límites. Mismo patrón que la web (PlansPage): filtra
 * `is_active` y ordena por `listing_priority` descendente.
 *
 * Si la query falla, devolvemos `undefined` y los callers degradan a los
 * fallbacks estáticos de `lib/subscription.ts`.
 */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('listing_priority', { ascending: false });

      if (error) throw error;
      return (data || []) as SubscriptionPlan[];
    },
    staleTime: 60_000, // 1 min
  });
}
