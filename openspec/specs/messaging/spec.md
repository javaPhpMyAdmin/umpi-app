# Messaging Specification

## Purpose

Covers conversations list display, last-message query, and rendering behavior for the Umpi messaging domain.

## Requirements

### R1: Show last message text in conversation list

Each conversation row in the messages list MUST display the text of the most recent message in that conversation.

#### Scenario: Conversation has messages

- Given a conversation contains one or more messages
- When the user views the messages list
- Then the row shows the last message text below the listing title

#### Scenario: Conversation has no messages

- Given a conversation has zero messages
- When the user views the messages list
- Then the row MUST NOT show any last-message line
- And the layout remains aligned (no empty gap)

#### Scenario: Long message text truncates

- Given the last message content exceeds the available row width
- When the row renders
- Then the text truncates with an ellipsis (`numberOfLines={1}`)
- And MUST NOT wrap to multiple lines

### R2: Efficient last-message query

The system MUST fetch the latest message per conversation using Postgres `DISTINCT ON (conversation_id)` ordered by `created_at DESC`.

#### Scenario: Correct per-conversation result

- Given a set of conversations from `fetchConversations`
- When the DISTINCT ON query executes
- Then each conversation receives exactly its most recent message
- And conversations with no messages produce no error or stale content

#### Scenario: Empty conversation gets no stale state

- Given a conversation has no messages in the `messages` table
- When the DISTINCT ON query returns no row for that conversation_id
- Then `last_message` stays `undefined` on that Conversation object
- And the UI renders no last-message line (per R1 no-messages scenario)

### R3: Type-safe mapping

The query result MUST map onto `Conversation.last_message?: Message` (already defined in `types/index.ts`).

#### Scenario: TypeScript compiles cleanly

- Given a valid DISTINCT ON result with full Message shape
- When assigned to `conversation.last_message`
- Then TypeScript compiles with no new errors (`npm run typecheck`)

### R4: UI styling and placement

The last message text MUST render below the listing title as a single-line muted text element.

#### Scenario: Correct visual hierarchy

- Given a conversation row with a `last_message` value
- When the row renders
- Then the message text appears between the listing title and the arrow icon
- And uses `Colors.textMuted` and `fontSize: 13` (same as listing title)
- And has no extra margin above (visual grouping with listing)
