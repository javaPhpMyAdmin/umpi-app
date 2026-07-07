# Tasks: Reviews & Rating System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation

- [x] **1.1 Migration SQL** — Create `supabase/migrations/20260705000001_add_reviews_system.sql` with reviews table, UNIQUE constraint, check constraint, FK cascades, `fn_recalculate_ratings()` trigger function, `trg_recalculate_ratings` trigger (INSERT/UPDATE/DELETE), `reviews_count` column on `listings`, indexes on `conversation_id` and `reviewer_id`, and RLS policies (select participant, insert participant + not-owner, no update/delete). Deps: none. AC: Migration runs clean; reviews table exists with constraints; trigger recalculates listing.rating, reviews_count, and profiles.rating on INSERT/UPDATE/DELETE; RLS blocks non-participants. Complexity: **medium**.

- [x] **1.2 TypeScript types** — Add `Review` interface (id, conversation_id, reviewer_id, rating, comment?, created_at) to `types/index.ts` and add `reviews_count: number` to `Listing`. Deps: none. AC: `Review` matches DB schema; `Listing` includes `reviews_count`; `tsc --noEmit` passes. Complexity: **small**.

## Phase 2: Core Implementation

- [x] **2.1 ReviewModal component** — Create `components/ReviewModal.tsx`: modal with 5 star `TouchableOpacity` icons (Colors.star selected / Colors.border empty), multiline `TextInput` (placeholder "Comentario (opcional)", maxLength 500), "Enviar calificación" button (disabled while submitting), "Cancelar" link, inline error text. Local state: `selectedRating`, `comment`, `submitting`, `error`. Accepts `visible`, `onClose`, `onSubmit`, `conversationId` props. Deps: 1.2. AC: Stars highlight up to tapped position; submit fires `onSubmit(rating, comment)`; error renders inline; submitting disables button. Complexity: **medium**.

- [x] **2.2 Listing detail screen — review wiring** — Modify `app/listing/[id].tsx`: add `checkReviewEligibility()` that queries conversations by listing_id + user, then checks reviews by conversation_id + reviewer_id. Store `hasConversation` (conversation_id or null) and `hasReviewed` (boolean). Render "Calificar vendedor" button below seller section when `user && !isOwnListing && hasConversation && !hasReviewed`. Render "Ya calificaste este aviso" text when `hasConversation && hasReviewed`. Wire ReviewModal open/close/submit. Submit calls `supabase.from('reviews').insert({ conversation_id, reviewer_id: user.id, rating, comment })` and catches unique violation (23505) for "Ya calificaste a este vendedor." On success, close modal, set `hasReviewed = true`. Deps: 2.1, 1.2. AC: Button visibility matches spec matrix; modal opens; successful submit updates state; duplicate reviews show correct error; own listings never show button. Complexity: **medium**.

## Phase 3: Data Layer

- [x] **3.1 Mock data updates** — Add `reviews_count` to each entry in `constants/mockData.ts` per design values (l1=3, l2=12, l3=8, l4=25, l5=100, l6=15, l7=30, l8=2, l9=50, l10=40, l11=18, l12=22). Deps: 1.2. AC: Every mock listing has a non-null `reviews_count` matching the design. Complexity: **small**.

## Phase 4: Verification

- [x] **4.1 Verify build** — Run `npm run typecheck` (`tsc --noEmit`). Fix any TS errors. Manual walkthrough of visibility matrix on listing detail. Deps: all prior. AC: `tsc --noEmit` passes; no type errors. Complexity: **small**.

## File Change Summary

| File | Action | Est. Lines |
|------|--------|------------|
| `supabase/migrations/20260705000001_add_reviews_system.sql` | CREATE | ~120 |
| `types/index.ts` | MODIFY | ~10 |
| `components/ReviewModal.tsx` | CREATE | ~130 |
| `app/listing/[id].tsx` | MODIFY | ~70 |
| `constants/mockData.ts` | MODIFY | ~12 |
