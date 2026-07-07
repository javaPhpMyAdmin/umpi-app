# Proposal: Mejora en mensajes y conversaciones

## Intent

Users cannot see what the last message in a conversation was from the messages list. They have to open each conversation to check if there's something new. This adds friction — especially for users with many conversations — and hurts the quick-scan experience the list is meant to provide.

## Scope

### In Scope
- Display the last message text below the other user's name in each conversation row on the Messages screen
- Query the latest message per conversation in `fetchConversations` using a second Supabase query

### Out of Scope
- Changes to the chat header (stays as-is — name only)
- Changes to the contact flow (creates conversation, navigates to chat, no auto-message)
- Automatic greeting when a conversation is created
- Unread count or read receipts
- Schema changes (no new columns or migrations)
- Database triggers or functions

## Capabilities

### New Capabilities
- `messaging`: Conversations list display, chat interaction, and message lifecycle

### Modified Capabilities
- None

## Approach

Modify `fetchConversations()` in `app/(tabs)/messages.tsx` to perform a second query fetching the latest message per conversation using Postgres `DISTINCT ON`. Map the result onto each conversation's `last_message` (already defined on `Conversation` type) and render it as a single-line text below the listing title in the row.

No schema changes, no RPCs, no new components.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(tabs)/messages.tsx` | Modified | Add last-message query + display line |
| `types/index.ts` | None | `last_message?` already defined on `Conversation` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Extra Supabase query per list load | Low | Conversations per user is naturally bounded; negligible perf |
| Last message shows stale text if user navigates back without refetch | Low | `fetchConversations` runs on mount — already correct |

## Rollback Plan

Revert the single file `app/(tabs)/messages.tsx` to its previous state. No schema changes means zero migration risk.

## Dependencies

None.

## Success Criteria

- [ ] Each conversation row shows the last message text below the listing title
- [ ] Text truncates to one line (no overflow)
- [ ] Conversations with no messages show no last-message line
- [ ] TypeScript compiles with no new errors
