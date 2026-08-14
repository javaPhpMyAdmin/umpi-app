/*
# Filter blocked users from unread badge

`get_total_unread_count` previously counted messages from ANY sender the
user hasn't read yet. Once `user_blocks` exists (shared DB, created by the
web repo migration `20260814000001_play_store_compliance.sql`), messages
from users the caller blocked must NOT count toward the unread badge —
otherwise a blocked user could keep the badge lit by messaging you.

Filter added: exclude messages whose sender is in `user_blocks` with
blocker_id = the caller (p_user_id) and blocked_id = m.sender_id.

Deploy-order guard: `user_blocks` is created by the web repo migration on
the shared DB. If that migration hasn't run yet, the NOT EXISTS subquery
would reference a missing table and every RPC call would error (the mobile
`useUnreadCount` swallows errors and the badge would go dead). The
`to_regclass('public.user_blocks') IS NOT NULL` presence check falls back
to the unfiltered count when the table is absent — no error, badge keeps
working. The check is evaluated at runtime on every call, so the filter
engages automatically the moment the web migration lands; no re-run of
this migration is needed.

Hardening: the function is SECURITY DEFINER, so it now sets
`search_path = ''` with fully-qualified table names (the original
definition in 20260708000001 used unqualified names) — a hostile object
in the caller's search path can't be picked up.
*/

CREATE OR REPLACE FUNCTION get_total_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total bigint;
BEGIN
  SELECT COALESCE(SUM(cnt), 0) INTO total
  FROM (
    SELECT COUNT(*) AS cnt
    FROM public.conversations c
    JOIN public.messages m ON m.conversation_id = c.id
    WHERE m.sender_id != p_user_id
      -- No contar mensajes de usuarios bloqueados por el usuario actual;
      -- presente solo si la tabla user_blocks ya existe (deploy-order guard)
      AND (to_regclass('public.user_blocks') IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM public.user_blocks ub
             WHERE ub.blocker_id = p_user_id AND ub.blocked_id = m.sender_id
           ))
      AND NOT (c.archived_by @> ARRAY[p_user_id])
      AND (
        (c.user1_id = p_user_id AND m.created_at > COALESCE(c.user1_last_read_at, '1970-01-01'::timestamptz))
        OR
        (c.user2_id = p_user_id AND m.created_at > COALESCE(c.user2_last_read_at, '1970-01-01'::timestamptz))
      )
    GROUP BY c.id
  ) sub;

  RETURN total;
END;
$$;
