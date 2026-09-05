-- ============================================================
-- Migration: Phase 0 — Identity foundations
-- Date: 2026-09-05
-- ============================================================
-- Adds the unified institutional identity + account status model to
-- `profiles` (approved Decisions 1 & 2). Additive only — no existing
-- column, foreign key, or RLS policy is modified.
--
--   1. profiles.institutional_id TEXT UNIQUE
--      The single human-facing institutional identity (Decision 1).
--      Backfilled deterministically from the existing authoritative
--      identifiers — values are preserved, nothing renamed:
--          students.enrollment_number  (e.g. STU001)
--          teachers.employee_id        (e.g. TCH001)
--      Admin/super_admin rows are intentionally left NULL here:
--      administrator institutional IDs are assigned through the
--      authoritative provisioning/registry process (Decision 6) and are
--      NOT invented by this migration.
--
--   2. profiles.status TEXT (pending | active | suspended | disabled)
--      Account lifecycle (Decision 2). DEFAULT 'active' + existing rows
--      backfilled to 'active' so legacy trigger-created accounts keep
--      working during the transition (Decision 5).
--
--   3. is_active <-> status synchronization trigger so the legacy boolean
--      and the new status can never drift apart, whichever one a writer
--      touches. status is authoritative; is_active stays readable for
--      existing checks (e.g. demo-login).
--
-- Apply ONCE from the Supabase Dashboard → SQL Editor.
-- A commented reversal (down) section is at the bottom of this file.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) Defensive pre-check: refuse to run if any student
--    enrollment_number equals a teacher employee_id — the unique
--    institutional_id index would otherwise fail mid-backfill with a
--    cryptic duplicate-key error.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.teachers t ON t.employee_id = s.enrollment_number
  ) THEN
    RAISE EXCEPTION
      'Phase 0 aborted: an enrollment_number equals an employee_id. Resolve the identifier collision first, then re-apply.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1) institutional_id — unique, human-facing institutional identity
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS institutional_id TEXT;

-- Backfill students first (role-table precedence if a profile anomalously
-- has both role rows — the second UPDATE skips non-NULL values).
UPDATE public.profiles AS p
SET institutional_id = s.enrollment_number
FROM public.students AS s
WHERE s.profile_id = p.id
  AND p.institutional_id IS NULL;

-- Backfill teachers.
UPDATE public.profiles AS p
SET institutional_id = t.employee_id
FROM public.teachers AS t
WHERE t.profile_id = p.id
  AND p.institutional_id IS NULL;

-- Uniqueness + lookup index, created AFTER the backfill so any collision
-- surfaces as the explicit error above rather than a key violation.
-- (NULLs are permitted — administrators awaiting assignment.)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_institutional_id_uidx
  ON public.profiles (institutional_id);

-- ------------------------------------------------------------
-- 2) status — account lifecycle (pending/active/suspended/disabled)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT
  DEFAULT 'active'
  CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'active', 'suspended', 'disabled'));

-- Every profile that works today is an active account (ADD COLUMN with a
-- DEFAULT already fills existing rows; this documents intent explicitly).
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;

-- Lifecycle values are always present.
ALTER TABLE public.profiles
  ALTER COLUMN status SET NOT NULL;

-- ------------------------------------------------------------
-- 3) is_active <-> status synchronization trigger
-- ------------------------------------------------------------
-- Rules:
--   INSERT, or a write that changes `status`  -> status wins; is_active
--                                                follows (status='active').
--   A write that changes only `is_active`     -> mirrored into status where
--                                                the mapping is unambiguous:
--                                                  active    -> suspended (off)
--                                                  suspended -> active    (on)
--   'pending' / 'disabled' can only be entered or left via an explicit
--   `status` write — flipping the boolean on them is ignored by design.
CREATE OR REPLACE FUNCTION public.sync_profile_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active THEN
      IF OLD.status = 'suspended' THEN
        NEW.status := 'active';
      END IF;
    ELSE
      IF OLD.status = 'active' THEN
        NEW.status := 'suspended';
      END IF;
    END IF;
    NEW.is_active := (NEW.status = 'active');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_status ON public.profiles;
CREATE TRIGGER trg_profiles_sync_status
  BEFORE INSERT OR UPDATE OF status, is_active ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_status();

-- ------------------------------------------------------------
-- 4) Lookup indexes
-- ------------------------------------------------------------
-- (institutional_id lookups are served by the unique index above.)
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles (status);

COMMIT;

-- ============================================================
-- REVERSAL (only if Phase 0 must be rolled back)
-- ============================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_profiles_sync_status ON public.profiles;
-- DROP FUNCTION IF EXISTS public.sync_profile_status();
-- DROP INDEX IF EXISTS public.idx_profiles_status;
-- DROP INDEX IF EXISTS public.profiles_institutional_id_uidx;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS institutional_id;
-- COMMIT;
-- NOTE: reversal discards lifecycle state held in `status`; re-apply the
-- migration afterwards to rebuild it.