# Design: Reviews & Rating System

## Technical Approach

Database-level rating recalculation via a `FOR EACH ROW` trigger on `reviews` (INSERT/UPDATE/DELETE), gated by RLS and a `UNIQUE(conversation_id, reviewer_id)` constraint. All UI lives in a new `ReviewModal` component composed into the existing `ListingDetailScreen` — no new routes. Visibility is governed by three booleans (`hasConversation`, `hasReviewed`, `isOwnListing`) derived from Supabase queries on screen mount.

## Architecture Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Rating recalculation | Application-level (after insert, update in code) vs. DB trigger | DB trigger (`fn_recalculate_ratings`) | Eliminates stale-data window between insert and app recomputation; trigger is atomic with the write. No risk of client disconnect leaving inconsistent state. |
| Review entry UI | Separate route (`app/review/[id].tsx`) vs. inline modal | Inline modal (`ReviewModal`) | Per spec R4: no new routes. Modal keeps user in context; avoids breaking the listing detail flow. |
| Button visibility checks | Single Supabase query with joins vs. three separate queries | Single query chain: conversation → review | Minimizes round-trips; `conversation` check is the gate and the review check is a dependent sub-query. |
| Duplicate prevention | Application-level check vs. DB constraint | Both: UNIQUE constraint + client pre-check | UNIQUE is the hard guarantee; client pre-check prevents the round-trip failure UX. |

## Data Flow

```
User         ListingDetail        ReviewModal          Supabase         Trigger
 │                  │                    │                  │                │
 │  tap "Calificar" │                    │                  │                │
 │─────────────────→│                    │                  │                │
 │                  │  open modal        │                  │                │
 │                  │───────────────────→│                  │                │
 │  select stars    │                    │                  │                │
 │──────────────────────────────────────→│                  │                │
 │  tap "Enviar"    │                    │                  │                │
 │──────────────────────────────────────→│                  │                │
 │                                      │  INSERT review    │                │
 │                                      │─────────────────→│                │
 │                                      │                  │ AFTER INSERT   │
 │                                      │                  │───────────────→│
 │                                      │                  │                ├── AVG(rating)
 │                                      │                  │                │   → listings
 │                                      │                  │                ├── profiles
 │                                      │                  │                │←───────────
 │                                      │     success      │                │
 │                                      │←─────────────────│                │
 │                   close + refetch    │                  │                │
 │                  ←───────────────────│                  │                │
 │  "Ya calificaste"│                    │                  │                │
 │←─────────────────│                    │                  │                │
```

## Component Tree

```
ListingDetailScreen (app/listing/[id].tsx)
├── ScrollView
│   ├── Image header (existing)
│   ├── Title/price/meta (existing)
│   ├── Description (existing)
│   ├── Seller section (existing)
│   │   └── [conditional] "Calificar vendedor" button [NEW]
│   │   └── [conditional] "Ya calificaste este aviso" text [NEW]
│   └── ReviewModal [NEW] (shown when showModal=true)
│       ├── Header: "Calificar al vendedor"
│       ├── 5× TouchableOpacity stars (Colors.star / Colors.border)
│       ├── TextInput (multiline, placeholder "Comentario (opcional)", max 500)
│       ├── [conditional] Error Text (submitError state)
│       ├── "Enviar calificación" button (disabled while submitting)
│       └── "Cancelar" link
└── BottomBar with "Contactar" (existing)
```

## Route Design

No new routes. All review UI lives in the existing `app/listing/[id].tsx`. The `ReviewModal` is a React Native `Modal` component rendered conditionally at the bottom of the screen JSX.

## Migration SQL

**File name**: `supabase/migrations/20260705000001_add_reviews_system.sql`

```sql
-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text CHECK (char_length(comment) <= 500),
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, reviewer_id)
);

-- Add reviews_count to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

-- Trigger function
CREATE OR REPLACE FUNCTION fn_recalculate_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_listing_id uuid;
  v_seller_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT listing_id INTO v_listing_id FROM conversations WHERE id = OLD.conversation_id;
  ELSE
    SELECT listing_id INTO v_listing_id FROM conversations WHERE id = NEW.conversation_id;
  END IF;

  -- Get seller
  SELECT user_id INTO v_seller_id FROM listings WHERE id = v_listing_id;

  -- Update the listing's average rating and count
  UPDATE listings
  SET
    rating = COALESCE(
      (SELECT ROUND(AVG(r), 1) FROM (
        SELECT r.rating FROM reviews r
        JOIN conversations c ON c.id = r.conversation_id
        WHERE c.listing_id = v_listing_id
      ) sub),
      5.0
    ),
    reviews_count = (
      SELECT COUNT(*) FROM reviews r
      JOIN conversations c ON c.id = r.conversation_id
      WHERE c.listing_id = v_listing_id
    )
  WHERE id = v_listing_id;

  -- Update the seller's overall profile rating
  UPDATE profiles
  SET rating = COALESCE(
    (SELECT ROUND(AVG(rating), 1) FROM listings WHERE user_id = v_seller_id),
    5.0
  )
  WHERE id = v_seller_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_recalculate_ratings ON reviews;
CREATE TRIGGER trg_recalculate_ratings
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION fn_recalculate_ratings();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_conversation ON reviews(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Select: participants see their own conversation's reviews
DROP POLICY IF EXISTS "reviews_select_participant" ON reviews;
CREATE POLICY "reviews_select_participant" ON reviews FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = reviews.conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- Insert: participant, not listing owner, and rate as yourself
DROP POLICY IF EXISTS "reviews_insert_participant" ON reviews;
CREATE POLICY "reviews_insert_participant" ON reviews FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN listings l ON l.id = c.listing_id
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
      AND l.user_id != auth.uid()
    )
  );

-- Update/Delete not supported (out of scope)
DROP POLICY IF EXISTS "reviews_no_update" ON reviews;
CREATE POLICY "reviews_no_update" ON reviews FOR UPDATE
  TO authenticated USING (false);

DROP POLICY IF EXISTS "reviews_no_delete" ON reviews;
CREATE POLICY "reviews_no_delete" ON reviews FOR DELETE
  TO authenticated USING (false);
```

## Component Props

```typescript
// components/ReviewModal.tsx
interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  conversationId: string;
}
```

The component manages its own local state for `selectedRating`, `comment`, `submitting`, and `error`. The parent `ListingDetailScreen` manages the `hasConversation`/`hasReviewed` booleans and passes `onSubmit` as a handler that calls Supabase directly.

## State Management

All state lives in `ListingDetailScreen`:

```typescript
// Derived on mount
const [hasConversation, setHasConversation] = useState<string | null>(null); // conversation_id or null
const [hasReviewed, setHasReviewed] = useState(false);

// Modal control
const [showModal, setShowModal] = useState(false);
const [submitError, setSubmitError] = useState<string | null>(null);

// Fetch logic (runs after listing + user resolve)
const checkReviewEligibility = async () => {
  if (!user || listing.user_id === user.id) return;
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listing.id)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle();
  if (!conv) return;
  setHasConversation(conv.id);
  const { data: review } = await supabase
    .from('reviews')
    .select('id')
    .eq('conversation_id', conv.id)
    .eq('reviewer_id', user.id)
    .maybeSingle();
  if (review) setHasReviewed(true);
};
```

**Button visibility** (rendered in seller section):

| `user` | `isOwnListing` | `hasConversation` | `hasReviewed` | Widget |
|--------|---------------|-------------------|---------------|---------|
| null | — | — | — | None |
| logged in | true | — | — | None |
| logged in | false | null | — | None |
| logged in | false | set | false | "Calificar vendedor" button |
| logged in | false | set | true | "Ya calificaste este aviso" text |

## Edge Cases Handled in Code

| Case | Handling |
|------|----------|
| Loading conversation/review state | Show nothing in review area until both queries resolve |
| Supabase insert fails (network/DB down) | `submitError` set → inline error rendered in modal; submit re-enabled |
| UNIQUE constraint violation at insert | Catch Postgres error code `23505` → show "Ya calificaste a este vendedor." |
| No conversation | Button never renders (`hasConversation` is null) |
| Own listing | Button never rendered; INSERT RLS blocks DB-level bypass |
| Double tap on submit | Button disabled while `submitting` (useState boolean) |
| Comment exceeds 500 chars | `maxLength={500}` on TextInput; server CHECK as safety net |
| Modal already open | User can dismiss via "Cancelar" or backdrop tap |
| After successful submit | Modal closes, `hasReviewed` = true, trigger updates ratings server-side, on next render button replaced by text |

## Mock Data Updates (`constants/mockData.ts`)

Add `reviews_count` to each `mockListings` entry. Existing `rating` values stay — they now represent computed averages:

```
// Before:
{ id: 'l1', ..., rating: 4.8, ... }
// After:
{ id: 'l1', ..., rating: 4.8, reviews_count: 3, ... }
```

Values per listing: l1=3, l2=12, l3=8, l4=25, l5=100, l6=15, l7=30, l8=2, l9=50, l10=40, l11=18, l12=22 (matching each seller's `total_sales` for plausibility).

No `mockReviews` array needed — mock data bypasses the trigger, so reviews_count is a static fallback value.

## Type Updates (`types/index.ts`)

```typescript
// New type
export interface Review {
  id: string;
  conversation_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

// Modified: add reviews_count to Listing
export interface Listing {
  // ...existing fields unchanged...
  rating: number;
  reviews_count: number;  // ← ADD
  // ...existing fields unchanged...
}
```
