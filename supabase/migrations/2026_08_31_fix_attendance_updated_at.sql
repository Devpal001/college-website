-- ============================================
-- FIX: add missing updated_at column on attendance
-- ============================================
-- The `update_updated_at_column()` trigger function is created by
-- schema.sql and applied to `attendance` via the
-- `update_attendance_updated_at` BEFORE UPDATE trigger. That trigger
-- references NEW.updated_at, but the `attendance` table was created
-- WITHOUT an updated_at column.
--
-- Symptoms:
--   • UPDATEs / PostgREST upserts (ON CONFLICT DO UPDATE) on attendance fail
--     with: record "new" has no field "updated_at"
--   • Until this is applied, all code paths write attendance via
--     delete-then-insert so they keep working (see
--     server/routes/records.js and scripts/seed-demo.mjs).
--
-- Apply this file once from the Supabase Dashboard → SQL Editor:

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Keep the pre-existing UPDATE trigger functioning exactly as designed.
-- (No further changes required — update_updated_at_column() sets the field.)