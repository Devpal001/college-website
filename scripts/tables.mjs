// ============================================================
// CANONICAL TABLE LIST (single source of truth for tooling)
// ------------------------------------------------------------
// Used by the backup/export/verification scripts so a new table cannot be
// forgotten in one place but remembered in another.
//
// Ordering matters when restoring: referenced (parent) tables come before the
// tables that point at them, so foreign keys resolve.
//
// Keep in sync with supabase/schema.sql + supabase/migrations/.
// `messages` and `admissions` are the public form tables written by
// server/routes/public.js.
// ============================================================

export const TABLES = [
  // Identity & academic structure
  'profiles',
  'departments',
  'courses',
  'semesters',
  'sections',
  'subjects',
  'rooms',
  // People
  'students',
  'teachers',
  // Structure links
  'enrollments',
  'teacher_subjects',
  'timetable',
  // Academic records
  'assessments',
  'attendance_sessions',
  'attendance',
  'marks',
  // Communication
  'notifications',
  'notification_preferences',
  'announcements',
  'events',
  'documents',
  // Public submissions
  'admissions',
  'messages',
  // News + AI agent
  'news_sources',
  'news_items',
  'ai_agent_runs',
  'ai_agent_events',
  // Audit & account lifecycle
  'audit_logs',
  'account_activations',
];

export default TABLES;