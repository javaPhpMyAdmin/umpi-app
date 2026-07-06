/*
# Listing Images Storage Bucket

1. Creates a `listing-images` bucket in Supabase Storage
2. Sets it as public (anyone can view)
3. RLS policies: public read, authenticated upload/delete

Important:
- Run this in the Supabase Dashboard SQL Editor (no Supabase CLI configured)
- Requires the storage schema to be available (default in all Supabase projects)
- 5MB file size limit, only JPEG/PNG/WebP
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view images (needed for listing display)
CREATE POLICY "listing_images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'listing-images');

-- RLS: authenticated users can upload
CREATE POLICY "listing_images_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND auth.role() = 'authenticated'
);

-- RLS: owner can update their own images
CREATE POLICY "listing_images_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'listing-images' AND owner = auth.uid());

-- RLS: owner can delete their own images
CREATE POLICY "listing_images_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-images' AND owner = auth.uid());
