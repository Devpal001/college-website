-- ============================================================
-- Migration: Phase 2 — Institutional ID login + status enforcement
-- Date: 2026-09-05
-- ============================================================
-- Adds an index that supports the Phase 2 login endpoint's
-- profiles.institutional_id lookup. No schema changes beyond
-- this index — relies on Phase 0's institutional_id + status columns.
--
-- Reversal:
--   DROP INDEX IF EXISTS public.idx_profiles_institutional_id;
-- ============================================================

CREATE INDEX IF NOT EXISTS public.idx_profiles_institutional_id
  ON public.profiles USING btree (institutional_id);
