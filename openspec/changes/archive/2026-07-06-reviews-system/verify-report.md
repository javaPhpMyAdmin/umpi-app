## Verification Report

**Change**: reviews-system
**Version**: N/A
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 6 |
| Tasks complete | 6 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build (TypeCheck)**: ✅ Passed
```text
> tsc --noEmit
(exit 0, no errors)
```

**Tests**: ➖ No test framework configured in the project.

**Coverage**: ➖ Not available (no test framework configured).

### Spec Compliance Matrix
No test framework is available, so runtime compliance cannot be proven. All assessments below are based on static code analysis.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| **R1: Submit Review** | ✅ Implemented | `handleSubmitReview` inserts into `reviews` with rating + comment. Error-to-Spanish-text mapping present. |
| **R2: Rating Recalculation** | ⚠️ Partial | Trigger recalculates `listings.rating`, `listings.reviews_count` correctly. **`profiles.rating` uses per-listing average instead of per-review average — see CRITICAL #1.** |
| **R3: Button Visibility** | ✅ Implemented | Visibility matrix matches spec exactly: none for unauthenticated/own/no-conversation, button for eligible, text for already-reviewed. Line 193 logic verified. |
| **R4: Self-Review Prevention** | ✅ Implemented | Client-side: `listing.user_id === user.id` early return in effect + `user.id !== listing.user_id` in render. DB-side: INSERT RLS enforces `l.user_id != auth.uid()`. |
| **R5: Double Review Prevention** | ✅ Implemented | `UNIQUE(conversation_id, reviewer_id)` constraint at DB level. Error code `23505` caught and mapped to "Ya calificaste a este vendedor." Submit button disabled while `submitting` prevents double-tap. |
| **R6: RLS & Participant Scoping** | ✅ Implemented | SELECT policy scoped to conversation participants. INSERT policy requires participant + not-owner + `auth.uid() = reviewer_id`. UPDATE/DELETE policies forbid all user-initiated operations. FK cascades are system-level and bypass RLS. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| DB trigger for rating recalculation | ✅ Yes | `fn_recalculate_ratings()` with `AFTER INSERT OR UPDATE OR DELETE` trigger |
| Inline modal (no new route) | ✅ Yes | `ReviewModal` composited in existing `app/listing/[id].tsx` |
| Single query chain for eligibility | ✅ Yes | Conversations query first, then reviews sub-query, both sequential |
| Both UNIQUE constraint + client check | ✅ Yes | DB constraint + error code mapping + `submitting` lock + `hasReviewed` pre-check |

### Issues Found

**CRITICAL**:
1. **`profiles.rating` trigger calculation deviates from spec** — The spec (R2, §3) states `profiles.rating` should be calculated "across all reviews for all listings owned by that seller." The implementation at line 54–58 of the migration computes `ROUND(AVG(rating), 1) FROM listings WHERE user_id = v_seller_id`, which averages **listing-level averages**, not **individual review ratings**. When a seller has listings with different review counts, this gives equal weight per listing rather than per review. Correct query would join through `reviews → conversations → listings` to average individual ratings: `SELECT ROUND(AVG(r.rating), 1) FROM reviews r JOIN conversations c ON c.id = r.conversation_id JOIN listings l ON l.id = c.listing_id WHERE l.user_id = v_seller_id`.

2. **"No conversation exists" error message never rendered** — The spec (R1) defines the scenario response as "No tenés una conversación sobre este aviso", but no code path produces this string. The button is absent when there's no conversation, so the user can't trigger this error. Either remove the message from the spec (since visibility handles it) or add a guard in `handleSubmitReview`.

**WARNING**:
1. **`reviewer_id` FK references `auth.users` instead of `profiles`** — The FK `REFERENCES auth.users(id) ON DELETE CASCADE` means the cascade goes to the auth.users table. If a user profile is deleted from `profiles` but the auth.user remains, reviews are kept. This is correct if user deletion means auth deletion. If profiles can be deleted independently, this may leave orphan references. Verify which deletion pattern is used in production.

2. **No explicit NOT NULL on `comment` column** — The spec defines `comment` as `NULLABLE`, and the SQL omits `NOT NULL` which correctly defaults to nullable. This is correct per spec, but the `CHECK (char_length(comment) <= 500)` could be `NULL`-aware (it is — `char_length(NULL)` = NULL in SQL, and CHECK passes for NULL). No bug here, just noting the implicit nullability.

**SUGGESTION**:
1. **Review eligibility queries could be cached/refactored** — `handleContact` at line 89 duplicates the same conversation lookup query. Consider extracting `findConversation(listingId, userId)` into a shared utility.
2. **Modal could show loading state while `onSubmit` is in flight** — The current implementation shows a spinner on the submit button, which is good. Consider disabling the star selection touchability during submit more explicitly (currently `!submitting` guard on star press is present — this is already done correctly at line 72).
3. **Consider adding a `listings.rating` precision comment** — The schema defines `listings.rating` as `numeric(2,1)` which can hold values up to 9.9. Since ratings are 1–5, the max avg is 5.0, so precision is safe. A SQL comment could help future maintainers.

### Verdict
**PASS WITH WARNINGS**

All 6 implementation tasks are complete, typecheck passes, and the visibility matrix matches the spec exactly. The only substantive issue is the `profiles.rating` calculation in the trigger function, which does not match the spec's behavior (per-listing average vs. per-review average). This should be corrected before the change is considered fully compliant.
