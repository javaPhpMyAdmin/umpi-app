# Supabase database — source of truth

The database is shared between the web app and the mobile app (project `fvlbxnixrutffgjrohvm`).

## Migrations

**The source of truth for database migrations is the web repo:**

`umpi-web/supabase/migrations/` (in the `umpi-web` repository)

Do NOT add or duplicate migration files here. Migrations are applied once to the shared
database; the web repo owns them. When the web repo adds a migration that the mobile app
depends on (e.g. legal consents, RLS changes), it is already live in the shared database —
no action needed in this repo.

If you ever bootstrap a fresh local environment from this repo, restore the database from
the web repo's migrations first.

## Local development

- `supabase/functions/` in this repo is empty by design: the mobile app does not deploy
  edge functions. All Edge Functions live in the web repo (`umpi-web/traspaso-supabase/supabase/functions/`)
  and are deployed from there.
