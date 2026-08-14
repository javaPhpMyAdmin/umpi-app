-- Migration: seed legal version '2026-08-14' (mobile mirror)
--
-- The mobile app ships LEGAL_VERSION = '2026-08-14' (lib/legalContent.ts).
-- The record_legal_consent RPC rejects any version missing from
-- legal_consent_versions, so the new version MUST be seeded here or the
-- consent gate stays locked for every user.
--
-- The web repo seeds the same row
-- (umpi-web/supabase/migrations/20260814000002_seed_legal_version_2026_08_14.sql)
-- on the shared DB. This migration mirrors it so the mobile build is
-- deploy-order independent: if mobile ships before web (or the web
-- migration hasn't run yet), the seed already exists and no user is locked
-- out. Idempotent via on conflict do nothing, so running after web is a
-- no-op.
--
-- Same conventions as the web seed: no grants/revokes — the registry is
-- deny-all (RLS enabled, client roles revoked, see
-- 20260731000005_legal_consent_server_side.sql) and only the SECURITY
-- DEFINER RPC reads it. The RPC and tamper trigger are untouched; nothing
-- here depends on them changing.
insert into public.legal_consent_versions (version, published_at)
values ('2026-08-14', now())
on conflict do nothing;
