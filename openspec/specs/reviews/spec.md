# Listing Reviews Specification

## Purpose

Buyers rate sellers after a conversation; aggregated ratings update `listings.rating`, `profiles.rating`, and `listings.reviews_count` in real time via a database trigger.

## Requirements

### R1: Submit Review

The system MUST allow an authenticated user who participated in a conversation about a listing to submit a rating (1–5) and optional comment for that listing's seller.

#### Scenario: Happy path — buyer submits review

- GIVEN the user is authenticated, has a conversation about listing L, and has NOT reviewed it
- WHEN the user submits `rating=4` and `comment="Buen trato, todo ok"`
- THEN the review is persisted and `listings.rating`, `profiles.rating`, `listings.reviews_count` recalculate

#### Scenario: No conversation exists

- GIVEN the user is authenticated but has NO conversation about listing L
- WHEN the user attempts to review
- THEN the system responds with "No tenés una conversación sobre este aviso"

#### Scenario: Supabase insert fails

- GIVEN the user submits a valid review
- WHEN the Supabase insert returns an error
- THEN the UI shows "Error al enviar la calificación. Intentalo de nuevo."

### R2: Rating Recalculation

The system SHALL recalculate aggregated ratings via a database trigger on INSERT, UPDATE, or DELETE of reviews.

#### Scenario: Insert updates listing and profile

- GIVEN listing L has an average of 4.0
- WHEN a user inserts a new review with `rating=5`
- THEN `listings.rating` becomes 4.5, `listings.reviews_count` increments by 1, and `profiles.rating` recalculates across all the seller's listings

#### Scenario: Delete recalculates from remaining

- GIVEN listing L has 3 reviews averaging 4.3
- WHEN a review is deleted
- THEN `listings.rating` recalculates from the 2 remaining reviews

#### Scenario: First review on a listing

- GIVEN listing L has zero reviews
- WHEN the first review with `rating=5` is inserted
- THEN `listings.rating` becomes 5.0, `listings.reviews_count` becomes 1, `profiles.rating` updates

#### Scenario: All reviews deleted — COALESCE to default

- GIVEN listing L had reviews but all were deleted
- WHEN the last delete triggers `fn_recalculate_ratings()`
- THEN COALESCE sets `listings.rating=5.0`, `reviews_count=0`

### R3: Button Visibility

The system MUST show "Calificar vendedor" on listing detail ONLY when the user is authenticated, has a conversation with the seller about that listing, and has NOT already submitted a review.

#### Scenario: Visible to eligible buyer

- GIVEN user U is authenticated, has a conversation about listing L, and no review exists
- WHEN the listing detail screen renders
- THEN the "Calificar vendedor" button appears below the seller section

#### Scenario: Hidden when no conversation

- GIVEN user U is authenticated but has NO conversation about listing L
- WHEN the listing detail screen renders
- THEN the button is absent

#### Scenario: Hidden when already reviewed

- GIVEN user U has already reviewed listing L
- WHEN the listing detail screen renders
- THEN the button is replaced by static text "Ya calificaste este aviso"

#### Scenario: Hidden for own listing

- GIVEN user U is the owner of listing L
- WHEN the listing detail screen renders
- THEN the button is absent

### R4: Self-Review Prevention

The system MUST NOT allow a user to review their own listing — enforced both client-side (button hidden) and at the DB level (RLS + participant check).

#### Scenario: Self-review blocked

- GIVEN user U owns listing L
- WHEN U attempts to insert a review where `conversation.listing_id.user_id = U`
- THEN the button is never rendered; no DB path exists

### R5: Double Review Prevention

The system MUST enforce `UNIQUE(conversation_id, reviewer_id)` at the database level.

#### Scenario: Duplicate insert rejected

- GIVEN user U already reviewed listing L via conversation C
- WHEN U attempts to insert another review with the same `conversation_id`
- THEN the DB rejects with a unique constraint violation and the UI shows "Ya calificaste a este vendedor."

### R6: RLS & Participant Scoping

The system MUST restrict reviews to conversation participants only.

#### Scenario: Non-participant cannot insert

- GIVEN user U is NOT a participant in conversation C
- WHEN U attempts to INSERT a review for conversation C
- THEN RLS blocks (empty result set, no row inserted)

#### Scenario: Non-participant cannot read

- GIVEN user U is NOT a participant in conversation C
- WHEN U queries reviews for that conversation
- THEN RLS filters out the row

## Data Contracts

### `reviews` Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, DEFAULT `gen_random_uuid()` |
| conversation_id | `uuid` | NOT NULL, FK → `conversations(id)` ON DELETE CASCADE |
| reviewer_id | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| rating | `smallint` | NOT NULL, CHECK (rating >= 1 AND rating <= 5) |
| comment | `text` | NULLABLE, max 500 chars |
| created_at | `timestamptz` | DEFAULT `now()` |

**Constraint**: `UNIQUE(conversation_id, reviewer_id)`

### `listings` Column Addition

| Column | Type | Default |
|--------|------|---------|
| reviews_count | `integer` | DEFAULT 0 |

### `fn_recalculate_ratings()` Signature

```
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
```

**Behavior**:
1. Update `listings.rating` = `ROUND(AVG(rating), 1)` across all conversations referencing the listing; COALESCE to 5.0 if no reviews.
2. Update `listings.reviews_count` = `COUNT(*)` of reviews for the listing.
3. Update `profiles.rating` = `ROUND(AVG(rating), 1)` across all reviews for all listings owned by that seller; COALESCE to 5.0 if none.

**Trigger**: `AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION fn_recalculate_ratings()`

## UI Behavior

### Visibility Matrix

| Condition | Widget |
|-----------|--------|
| Not authenticated | None |
| Own listing | None |
| No conversation about this listing | None |
| Has conversation, not reviewed | "Calificar vendedor" button |
| Has conversation, already reviewed | "Ya calificaste este aviso" text |

### Rating Modal

- **Title**: "Calificar al vendedor"
- **Stars**: 5 interactive `TouchableOpacity` star icons — `Colors.star` (#F59E0B) when selected, `Colors.border` (#E5E7EB) when empty
- **Comment**: `TextInput` multiline, placeholder "Comentario (opcional)", maxLength 500
- **Submit**: "Enviar calificación" — disabled while loading
- **Cancel**: "Cancelar" link dismisses modal
- **Success**: Modal closes; button replaced by "Ya calificaste este aviso"
- **Error**: Inline error text below stars; submit re-enabled

### Client Validation

| Field | Rule |
|-------|------|
| rating | MUST be 1–5 (enforced client-side and DB CHECK) |
| comment | Optional, max 500 chars, trimmed |

## Error States

| Scenario | System Response |
|----------|----------------|
| Supabase insert error (network/DB down) | "Error al enviar la calificación. Intentalo de nuevo." |
| Unique constraint violation (double review) | "Ya calificaste a este vendedor." |
| No conversation exists | "No tenés una conversación sobre este aviso." |
| Deleted conversation (FK cascade) | Review auto-deleted; UI shows fresh state on next render |
| Deleted user account (FK cascade) | User's reviews cascade-deleted; trigger recalculates seller ratings |
| Trigger error | Supabase insert fails; user sees generic error message |

## Edge Cases

| Case | Handling |
|------|----------|
| Self-review | Button hidden client-side; RLS prevents DB insert |
| Double review | UNIQUE constraint + client-side check |
| Review on deleted conversation | FK CASCADE removes review; trigger recalculates |
| User deletes account | FK CASCADE removes reviews; trigger recalculates owner ratings |
| Zero reviews after deletion | COALESCE in trigger defaults rating to 5.0, reviews_count to 0 |
| All reviews for a seller deleted | `profiles.rating` resets to 5.0 per seller |
