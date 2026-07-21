# Notifications Specification

## Purpose

Provide a centralized notification center that surfaces review and subscription-expiry events via a bell icon and full notification screen. Replaces the per-event visibility gap with a single polling-based feed.

## Requirements

### R1: Notifications Table

The system MUST persist notifications in a `notifications` table with columns: `id` (uuid PK), `user_id` (uuid FK → auth.users), `type` (text — one of `review`, `subscription_expiry`), `title` (text), `body` (text), `data` (jsonb, nullable), `is_read` (boolean, default false), `created_at` (timestamptz, default now()).

#### Scenario: Row created on review INSERT

- GIVEN a review is inserted for listing L by reviewer R targeting seller S
- WHEN the `fn_notify_on_review()` trigger fires
- THEN a row MUST be inserted into `notifications` with `user_id = S`, `type = 'review'`, `title` containing R's name, `body` containing the rating and comment preview, and `data = '{"listing_id": L.id}'`

#### Scenario: Row created by subscription expiry cron

- GIVEN a user's subscription expires in exactly 3 days
- WHEN the daily cron job runs
- THEN a single notification row MUST be inserted with `type = 'subscription_expiry'`, `title = 'Tu plan vence pronto'`, `body` naming the plan, and `data = '{"subscription_id": ...}'`

#### Scenario: Duplicate expiry notification prevented

- GIVEN the cron already inserted an expiry notification for this user within the last 24 hours
- WHEN the cron runs again
- THEN it MUST NOT insert a duplicate — check for existing `subscription_expiry` notification with `created_at > now() - interval '1 day'`

### R2: Row-Level Security

The `notifications` table MUST enforce owner-scoped RLS: users can SELECT, UPDATE (mark read), and DELETE only their own rows. INSERT is permitted for authenticated users AND service-role (for triggers/cron).

#### Scenario: User cannot read another user's notifications

- GIVEN user A is authenticated
- WHEN A queries `notifications` for user B's rows
- THEN RLS returns zero rows

#### Scenario: Service-role insert succeeds

- GIVEN the reviews trigger fires with service-role context
- WHEN it inserts a notification for user B
- THEN the insert MUST succeed regardless of RLS

### R3: Unread Count

The system MUST expose a lightweight unread count via `SELECT count(*) FROM notifications WHERE user_id = :uid AND is_read = false`.

#### Scenario: Count returns correct value

- GIVEN user U has 3 unread and 2 read notifications
- WHEN the client queries unread count
- THEN it MUST return 3

#### Scenario: Count returns zero for new user

- GIVEN user U has no notifications
- WHEN the client queries unread count
- THEN it MUST return 0

### R4: Bell Icon Badge

The Home screen header MUST display a bell icon on the right side. The bell MUST show a numeric badge when unread count > 0 and no badge when unread count = 0.

#### Scenario: Badge shows count

- GIVEN user U has 5 unread notifications
- WHEN the Home screen renders
- THEN the bell icon shows badge "5"

#### Scenario: Badge hidden when zero

- GIVEN user U has 0 unread notifications
- WHEN the Home screen renders
- THEN the bell icon shows no badge

#### Scenario: Badge refreshes on tab focus

- GIVEN user U had 3 unread, reads 1 elsewhere, returns to Home
- WHEN `useFocusEffect` fires
- THEN unread count MUST re-query and badge updates to 2

### R5: Notification Screen

Tapping the bell navigates to `app/notifications.tsx`. The screen MUST display all notifications in reverse chronological order (latest 100), with unread items visually distinguished (bold title, accent background).

#### Scenario: Screen shows list

- GIVEN user U has 10 notifications
- WHEN U navigates to the notification screen
- THEN all 10 appear in reverse-chronological order with relative timestamps ("hace 2 horas")

#### Scenario: Screen shows empty state

- GIVEN user U has 0 notifications
- WHEN U navigates to the notification screen
- THEN "No tenés notificaciones" is displayed

### R6: Mark-as-Read on Tap

Tapping a notification MUST mark it as read (`is_read = true`) AND navigate to the context target.

#### Scenario: Tap navigates to listing

- GIVEN a review notification with `data.listing_id = L`
- WHEN user taps the notification
- THEN `is_read` is set to true
- AND the app navigates to listing detail for L

#### Scenario: Tap on deleted listing

- GIVEN a review notification with `data.listing_id = L`
- WHEN user taps and listing L no longer exists (query returns null)
- THEN the system MUST show "Este aviso ya no existe" message
- AND `is_read` is still set to true

#### Scenario: Tap on subscription expiry notification

- GIVEN an expiry notification (no listing context)
- WHEN user taps
- THEN `is_read` is set to true
- AND the app navigates to the plans/settings screen

### R7: Swipe-to-Delete

Each notification row MUST support swipe-to-delete, removing the row from the DB and the list.

#### Scenario: Delete removes row

- GIVEN user U has a notification N
- WHEN U swipes left and confirms delete
- THEN the row is deleted from `notifications`
- AND the list re-renders without N

### R8: Messages Tab Badge Removal

The Messages tab in `app/(tabs)/_layout.tsx` MUST NOT display its own unread badge. All event visibility is consolidated under the bell icon.

#### Scenario: Messages tab has no badge

- GIVEN user U has unread messages
- WHEN the tab bar renders
- THEN the Messages tab icon shows no badge counter

### R9: Notification Type (TypeScript)

A `Notification` interface MUST be added to `types/index.ts` with fields: `id`, `user_id`, `type` (string), `title`, `body`, `data` (Record<string, unknown> | null), `is_read` (boolean), `created_at`.

#### Scenario: Type compiles

- GIVEN the Notification interface is defined
- WHEN `npm run typecheck` runs
- THEN no new type errors are introduced

## Data Contracts

### `notifications` Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | `uuid` | PK, DEFAULT gen_random_uuid() |
| user_id | `uuid` | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| type | `text` | NOT NULL, CHECK IN ('review', 'subscription_expiry') |
| title | `text` | NOT NULL |
| body | `text` | NOT NULL |
| data | `jsonb` | NULLABLE |
| is_read | `boolean` | NOT NULL, DEFAULT false |
| created_at | `timestamptz` | NOT NULL, DEFAULT now() |

### RLS Policies

| Operation | Rule |
|-----------|------|
| SELECT | `user_id = auth.uid()` |
| INSERT | `auth.uid() = user_id OR (current_setting('request.jwt.claim.role') = 'service_role')` |
| UPDATE | `user_id = auth.uid()` (only `is_read` column) |
| DELETE | `user_id = auth.uid()` |

## Edge Cases

| Case | Handling |
|------|----------|
| Listing deleted before tap | Show "Este aviso ya no existe"; mark read |
| User account deleted | FK CASCADE removes all their notifications |
| Concurrent read + delete | Delete wins; list re-renders without row |
| Badge stale after background return | useFocusEffect re-queries on tab focus |
