-- ============================================
-- 2026-10-01: performance indexes
-- ============================================
-- Identified by the performance audit: the hot read paths filter on
-- timetable.section_id / timetable.teacher_id, enrollments.section_id and
-- attendance_sessions.teacher_id, none of which had an index (sequential
-- scans that grow with table size). Idempotent — safe to re-run, and safe
-- on databases where an index was already created out-of-band.

CREATE INDEX IF NOT EXISTS idx_enrollments_section ON public.enrollments (section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_section ON public.timetable (section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON public.timetable (teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher ON public.attendance_sessions (teacher_id);
