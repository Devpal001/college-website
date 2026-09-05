-- ============================================================
-- Migration: Phase 1 — Account activation registry
-- Date: 2026-09-05
-- ============================================================
-- Holds one-time activation credentials for PENDING institutional
-- accounts registered by administration (POST /api/users/registry).
-- A row is created when an administrator registers an authoritative
-- college identity (auth user + profile(status='pending') + role row);
-- the person activates with institutional ID + institutional email +
-- this code + a new password (POST /api/auth/activate), which flips
-- the account pending -> active and burns the code.
--
-- SECURITY:
--   - The RAW activation code is never stored — only a SHA-256 hash.
--   - Codes are single-use and expire (TTL set by the issuing endpoint).
--   - RLS deny-by-default for browsers: anonymous/authenticated clients have
--     NO policy and therefore NO access. The server-side service_role is
--     granted access via a single service_role FOR ALL policy (see below).
--   - One row per profile (UNIQUE) — re-issuing a code replaces it.
--
-- Apply ONCE from the Supabase Dashboard → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_activations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deny-by-default for browsers; the API (service_role) is granted explicit
-- access via a FOR ALL policy. For an RLS-enabled table that the querying
-- role does not own, PostgREST requires a policy granting that role access —
-- otherwise even the service role's own queries are blocked. No permissive
-- policy is created for anon/authenticated roles, so browsers keep zero access.
ALTER TABLE public.account_activations ENABLE ROW LEVEL SECURITY;

-- Service-role access for the Express API (activation/registry + audit): a
-- single FOR ALL policy scoped to service_role, so browser roles (anon,
-- authenticated) remain fully denied. Satisfies PostgREST's requirement that
-- the acting role hold a policy on RLS-enabled tables it does not own.
CREATE POLICY "Service role manages account activations"
  ON public.account_activations
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Reversal (only if Phase 1 must be rolled back):
--   DROP TABLE IF EXISTS public.account_activations;
-- (Registry profiles created meanwhile keep status='pending'; handle
--  them administratively before dropping the table.)
-- ============================================================