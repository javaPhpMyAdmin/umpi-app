# Tasks: Mejora en mensajes y conversaciones

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~40 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-always |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Last Message in Conversation List

- [x] **1.1 Add last message query and display** — Modify `app/(tabs)/messages.tsx`:
  - Add second Supabase query with `DISTINCT ON (conversation_id)` ordered by `created_at DESC` to fetch latest message per conversation from the `messages` table, filtering by the set of conversation IDs from the initial conversations query
  - Map the result onto each `conversation.last_message` (type `Message` already defined in `types/index.ts`)
  - Render `<Text numberOfLines={1} style={styles.convLastMessage}>` below `<Text style={styles.convListing}>` when `conv.last_message?.content` exists; render nothing when absent
  - Style: `Colors.textMuted`, `fontSize: 13`, no extra margin above the element, no gap when absent
  - Run `npm run typecheck` to verify no new type errors
