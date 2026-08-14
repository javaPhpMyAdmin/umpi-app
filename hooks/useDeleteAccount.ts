import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Permanently deletes the current user's account via the shared
 * `delete_account` RPC (SECURITY DEFINER, created in the web repo migration
 * on the shared database). The RPC removes the auth user and everything that
 * cascades from it (profile, listings, conversations, messages, reviews,
 * notifications, subscriptions) plus the user's storage objects.
 *
 * Callers must sign out and redirect (e.g. `/login`) after a successful run.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
    },
    onSuccess: () => {
      // The account no longer exists — drop all cached app state (listings,
      // conversations, profile, legal consents, notifications, etc.).
      queryClient.clear();
    },
  });
}
