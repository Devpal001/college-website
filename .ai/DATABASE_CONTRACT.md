# Database Contract

## Ownership

- **Agent 4** owns all database artifacts:
  - `supabase/schema.sql`
  - `supabase/migrations/*.sql`
  - `scripts/seed-demo.mjs`
  - `scripts/test-activation.mjs`
- No other agent may modify these files.
- Agent 1 reviews and approves all schema changes before they are applied.

## Migration Rules

1. **Naming:** `YYYY_MM_DD_feature_slug.sql` (e.g., `2026_09_08_admin_announcements.sql`).
2. **Idempotent:** Migrations must be safe to run once; do not rely on re-runs.
3. **Additive first:** Prefer `ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`, `ALTER POLICY`.
4. **Destructive changes** require explicit Agent 1 approval and a data-backup plan.
5. **`supabase/schema.sql` is the authoritative source.** After applying a migration, Agent 4 must update `schema.sql` to reflect the current state.

## Table Ownership Boundaries

| Domain | Tables | Notes |
|--------|--------|-------|
| Auth/Identity | `profiles`, `account_activations`, `audit_logs` | Agent 4; auth middleware consumed by Agent 3 |
| Academics | `departments`, `courses`, `semesters`, `sections`, `subjects`, `rooms`, `enrollments`, `teacher_subjects` | Agent 4; reference data consumed by Agents 2/3 |
| Records | `timetable`, `attendance_sessions`, `attendance`, `assessments`, `marks` | Agent 4; business logic in Agent 3 |
| Content | `announcements`, `events`, `documents`, `admissions`, `news_sources`, `news_items` | Agent 4; business logic in Agent 3 |
| Notifications | `notifications`, `notification_preferences` | Agent 4; trigger logic in Agent 3 |
| AI | `ai_agent_runs`, `ai_agent_events` | Agent 4; engine logic in Agent 3 |

## RLS Contract

1. **All tables have RLS enabled.**
2. **Policies are co-located in `supabase/schema.sql`.**
3. **Policy naming convention:**
   - `"Users can view own X"` — user-scoped SELECT
   - `"Teachers can view Y"` — role-scoped SELECT
   - `"Admins can manage X"` — admin ALL
   - `"Public can read X"` — unauthenticated SELECT
   - `"Service role manages X"` — privileged server-side access
4. **Service-role access** must be explicit; never grant broad `TO service_role` without a named policy.
5. **No anonymous access to sensitive tables:** `profiles`, `students`, `teachers`, `marks`, `attendance`, `ai_agent_runs`, `account_activations`.
6. **Public read is allowed for reference data:** `departments`, `courses`, `subjects`, `sections`, `rooms`, `timetable`, `news_sources` (active only), published `news_items`, `announcements`, `events`.

## Seed Data Contract

1. **`scripts/seed-demo.mjs` is idempotent.** It must be safe to run multiple times.
2. **Seed data includes:** demo identities, timetable, attendance, marks, notifications, news sources.
3. **New seed data** for a feature must be added in the same migration/seed update.
4. **Test data** must not interfere with production-like scenarios.

## Query Contract

- Server routes use the service-role client (`server/lib/db.js`).
- Frontend uses the anon client (`src/lib/supabase.js`) only for auth state and explicitly RLS-gated reads.
- Direct Supabase queries from frontend for authenticated data are prohibited.

## Change Process

1. Agent 4 proposes schema change to Agent 1.
2. Agent 1 approves and records in `.ai/DATABASE_CONTRACT.md`.
3. Agent 4 writes migration + updates `schema.sql`.
4. Agent 4 applies migration to Supabase.
5. Agent 4 updates `scripts/seed-demo.mjs` if needed.
6. Agent 3 and Agent 2 are notified that the schema change is live.
