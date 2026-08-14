/*
# Avatars Storage Bucket

1. Creates an `avatars` bucket in Supabase Storage
2. Sets it as public (anyone can view)
3. RLS policies: public read, authenticated upload, owner update/delete

Important:
- Run this in the Supabase Dashboard SQL Editor (no Supabase CLI configured)
- Requires the storage schema to be available (default in all Supabase projects)
- 5MB file size limit, only JPEG/PNG/WebP (matching listing-images)

The avatar is stored at the FIXED path `{userId}/avatar.webp` (see
lib/upload.ts uploadAvatar) and re-uploaded with upsert — the UPDATE policy
is what makes a re-upload work; without it the first upload succeeds and
every replacement fails with RLS.
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view avatars (needed for profile display)
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- RLS: authenticated users can upload
DROP POLICY IF EXISTS "avatars_insert_auth" ON storage.objects;
CREATE POLICY "avatars_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

-- RLS: owner can update their own avatar (required for upsert re-upload)
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid())
WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

-- RLS: owner can delete their own avatar
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());
