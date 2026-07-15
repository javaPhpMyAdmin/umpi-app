import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types';
import { deleteImage } from '@/lib/upload';

export function useListings() {
  return useQuery<Listing[]>({
    queryKey: ['listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*, category:category_id(*), city:city_id(*)')
        .eq('status', 'active')
        .order('listing_priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as Listing[];
    },
    staleTime: 60_000, // 1 min
  });
}

export function useMyListings(userId: string | undefined) {
  return useQuery<Listing[]>({
    queryKey: ['my-listings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*, category:category_id(*), city:city_id(*)')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .order('listing_priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Listing[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useEditListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      removedImages,
    }: {
      id: string;
      updates: Partial<Listing>;
      removedImages: string[];
    }) => {
      // Remove deleted images from storage (fire-and-forget)
      removedImages.forEach((url) => {
        deleteImage(url).catch((err) =>
          console.error('Error deleting image:', err),
        );
      });

      const { error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['listing', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      images,
    }: {
      id: string;
      images: string[];
    }) => {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'deleted' })
        .eq('id', id);

      if (error) throw error;

      // Cleanup images from storage (fire-and-forget)
      images.forEach((url) => {
        deleteImage(url).catch((err) =>
          console.error('Error deleting image:', err),
        );
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['listing', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}
