# Proposal: Reviews & Rating System

## Intent

`listings.rating` and `profiles.rating` are static defaults (5.0) with no collection mechanism. Buyers can't share post-conversation feedback, and sellers can't build reputations. This change adds a real review/rating system tied to conversations.

## Scope

### In Scope
- New `reviews` table + database trigger for aggregated ratings
- "Calificar vendedor" on listing detail (visible if user has a conversation about that listing and hasn't reviewed yet)
- 5-star rating modal with optional comment
- Update `listings.rating`, `profiles.rating`, `listings.reviews_count` via trigger
- TypeScript types for `Review`, `reviews_count` on `Listing`
- Mock data with real reviews for development
- New Supabase migration

### Out of Scope
- Editing or deleting reviews
- Review moderation / reporting
- Seller responses to reviews
- Filtering/sorting by rating on Explore (existing "Más populares" works automatically)

## Capabilities

### New Capabilities
- `listing-reviews`: submit, store, and display reviews tied to conversations; aggregated seller and listing ratings

### Modified Capabilities
None (no existing specs)

## Approach

1. **Migration**: create `reviews` table with UNIQUE(conversation_id, reviewer_id). Add `listings.reviews_count` column. Create `fn_recalculate_ratings()` trigger function on INSERT/UPDATE/DELETE of reviews.
2. **Types**: add `Review` interface, add `reviews_count` to `Listing`.
3. **UI**: add "Calificar vendedor" button to listing detail — visible for authenticated users with a conversation about that listing who haven't already reviewed. Opens modal with star selector + optional comment + submit. On submit, show "Ya calificaste este aviso".
4. **Data**: update mock data to use real review-based ratings.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Migration for reviews table + trigger + reviews_count |
| `types/index.ts` | Modified | New `Review` type; `reviews_count` on `Listing` |
| `app/listing/[id].tsx` | Modified | Add rating button + modal |
| `constants/mockData.ts` | Modified | Seed with real review data |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Trigger errors on heavy inserts | Low | Test trigger in isolation; use BEFORE DELETE to avoid FK issues |
| Existing conversations have no reviews → all ratings reset to NULL | Med | Trigger coalesce to 0 or default to 5.0 on first review |

## Rollback Plan

Drop the `reviews` table, remove `reviews_count` from listings, drop the trigger function. Existing `listings.rating` and `profiles.rating` revert to their default 5.0 values.

## Dependencies

- None (uses existing `conversations` table)

## Success Criteria

- [ ] Authenticated user with a conversation sees "Calificar vendedor" on listing detail
- [ ] Submitting a review updates `listings.rating` and `profiles.rating` in real time
- [ ] User cannot review the same conversation twice
- [ ] User cannot review their own listing
