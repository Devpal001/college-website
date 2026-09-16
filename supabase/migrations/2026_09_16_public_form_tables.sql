-- ============================================================
-- 2026-09-16 — PUBLIC FORM TABLES (portability / schema drift fix)
-- ============================================================
-- WHY THIS MIGRATION EXISTS
--   `POST /api/admissions` and `POST /api/contact` (server/routes/public.js)
--   write to the public form tables. `admissions` already exists, but
--   `messages` was ONLY present in the live database — it was never captured in
--   supabase/schema.sql or in a migration. A database restored from version
--   control therefore had a broken contact form, and the college could not
--   reproduce the deployment.
--
-- This migration is ADDITIVE and IDEMPOTENT: it is safe to run against the
-- live project and against a brand-new database provisioned for the college.
-- It creates nothing that already exists and deletes no data.
--
-- RLS POSTURE
--   Public submissions arrive through the Express API, which uses the
--   service-role key server-side (it bypasses RLS). The browser no longer
--   touches these tables, so anonymous INSERT policies are not required.
--   New tables therefore get RLS enabled with NO public write policy:
--   deny-by-default, admins can read.
-- ============================================================

-- ------------------------------------------------------------
-- messages — contact form submissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Admins may read submissions for follow-up. Anonymous and non-admin users get
-- nothing (no policy = no access under RLS).
DROP POLICY IF EXISTS "Admins can read messages" ON messages;
CREATE POLICY "Admins can read messages" ON messages
  FOR SELECT USING (auth_is_admin());

-- NOTE ON admissions: the table already exists (created by the original
-- deployment with an integer primary key, while supabase/schema.sql describes a
-- UUID key). The definition is intentionally left untouched here — changing an
-- existing key type would rewrite data in place. The API only inserts the
-- whitelisted columns (full_name, email, phone, course_applied, message), so
-- the drift does not affect behaviour; it is recorded in
-- docs/INDUSTRIAL_AUDIT.md for a future, deliberate cleanup.

-- ============================================================
-- OPTIONAL HARDENING — NOT APPLIED AUTOMATICALLY
-- ------------------------------------------------------------
-- The original deployment allowed anonymous INSERT on `admissions`:
--   "Public can submit admissions" ON admissions FOR INSERT WITH CHECK (true);
-- Now that the Express API performs every public write with the service role,
-- that policy is no longer needed and can be dropped so that a browser cannot
-- insert directly (and therefore cannot bypass API validation/rate limiting).
-- This changes LIVE access rules, so it is left as an explicit operator action:
--
--   DROP POLICY "Public can submit admissions" ON admissions;
--
-- Verified impact: POST /api/admissions keeps working (server-side service
-- role), while direct anon inserts stop being possible.
-- ============================================================