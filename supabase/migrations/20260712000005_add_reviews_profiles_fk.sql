/*
# Add FK from reviews.reviewer_id to profiles.id

PostgREST needs a foreign key relationship to embed related data via
nested select. Without this, the Supabase client can't do:

  .select('..., reviewer:profiles!reviewer_id(full_name, avatar_url)')

Both reviews.reviewer_id and profiles.id already reference auth.users(id),
so the data is consistent. This just makes the relationship explicit.

Note: reviews.reviewer_id already has a FK to auth.users(id) named
reviews_reviewer_id_fkey. We add a second FK to profiles(id) with a
different name.
*/

ALTER TABLE reviews
  ADD CONSTRAINT reviews_reviewer_id_profiles_fkey
  FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Refresh PostgREST schema cache so the new relationship is picked up
NOTIFY pgrst, 'reload schema';
