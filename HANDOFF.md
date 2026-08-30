# HANDOFF — Project Status & Remaining Work

> Prepared for Devin (or any continuing agent/developer).
> Repo: `college-website/` — https://github.com/Devpal001/college-website.git (branch `main`)
> Working dir: `c:\Users\singh\college website ai automated\college-website`
> Last updated: after Phase 5 push (`5d29a65`)

---

## 1. Project Context

MBSCET college digital platform:

- **Frontend**: React 19 + Vite, Tailwind (custom tokens like `bg-navbar`, `shadow-soft`, `rounded-soft`), `lucide-react` icons, React Router. Supabase JS on the client for auth (JWT) + anon queries.
- **Backend**: Node + Express. Two layers coexist in `server/index.js`:
  1. **Modular routers** (mounted FIRST at lines ~84-96 — these win): `server/routes/*.js` with `server/middleware/auth.js` + `server/lib/db.js`.
  2. Legacy inline handlers further down the same file (older Phase-2 monolith code). Do not rely on these for new work; they are shadowed for overlapping paths.
- **Database**: Supabase Postgres — full schema in `supabase/schema.sql` (includes tables for academics, attendance, marks, news, notifications, AI agent runs).
- **Master plan**: `IMPLEMENTATION_AUDIT.md` defines Phases 1-7 and effort estimates. `PHASE2_SETUP_GUIDE.md` covers Phase 2 setup.

### Commit history (latest first)
```
5d29a65  Phase 5: AI News Agent
1f0fdea  Phase 4: News Infrastructure
ba32a1b  Phase 3: Academic Platform (dashboards, attendance, marks, timetable)
81c30c0  feat: integrate Supabase backend and college data  (pre-existing)
```

## 2. Phase Status Overview

| Phase | Scope | Status |
|---|---|---|
| 1 | Audit & architecture mapping | ✅ Done (pre-existing audit docs) |
| 2 | Backend foundation (schema, env, monolith API) | ✅ Done (pre-existing) |
| 3 | Academic Platform — dashboards, attendance, marks, timetable | ✅ Done & pushed |
| 4 | News Infrastructure — model, API, admin console, public feed | ✅ Done & pushed |
| 5 | AI News Agent — scheduler, engine, classification, review | ✅ Done & pushed |
| 6 | Notification Engine | ⬜ Not started |
| 7 | AI Assistant | ⬜ Not started |

## 3. Environment & How to Run

`.env` at repo root (gitignored — NEVER commit). Keys in use:

```
SUPABASE_URL=...                 # server (service role)
SUPABASE_SERVICE_ROLE_KEY=...    # server only — bypasses RLS
VITE_SUPABASE_URL=...            # frontend
VITE_SUPABASE_ANON_KEY=...       # frontend
OPENAI_API_KEY=...               # optional — enables LLM classification (Phase 5)
AGENT_INTERVAL_MINUTES=60        # optional — 0 disables the agent scheduler
PORT=3001                        # server port
```

Commands:
```bash
npm install && npm run dev        # frontend (Vite)
cd server && node index.js        # backend (Express + agent scheduler)
npm run build                     # frontend production build (verify before pushing)
node --check <file>               # quick server syntax check
```

**IMPORTANT — Windows/PowerShell note for agents**: run git with `--no-pager`; `git push` progress on stderr can look like a failure in PowerShell — check `git status -sb` for `## main...origin/main` (synced) instead.

## 4. Work Completed in Detail

### 4.0 Repairs before any feature work
- **Fixed corrupted `server/routes/records.js` and `server/routes/academics.js`**: code blocks had been scrambled (e.g., `export default router;` mid-file, orphaned fragments after it, missing route-banner comments). Reassembled; verified with `node --check`.
- Deleted stale `server/routes/teachers.js.corrupt.bak`.
- **Renamed `src/hooks/useAuth.js` → `src/hooks/useAuth.jsx`** — it contains JSX and Vite refused to parse `.js` with JSX; this had blocked the production build. No import changes needed (extensionless imports).

### 4.1 Phase 3 — Academic Platform ✅
**Backend** (`server/routes/`, all using `authRequired` + role checks):
- `records.js`: `POST /attendance` (find-or-create `attendance_sessions` per section+subject+date → validate enrollment → upsert attendance rows), `PUT /attendance/:id` (own-session ownership check), `POST /marks` + `PUT /marks/:id` (max-marks validation, teacher-subject assignment check via `teacher_subjects`).
- `students.js`: `/me/dashboard` (aggregated attendance %, recent marks, today's classes), `/me/attendance`, `/me/marks`, `/me/timetable`.
- `teachers.js`: `/me/dashboard`, `/me/subjects`, `/me/schedule`, `/me/sessions`, plus `/assessments` CRUD (scoped to assigned subjects).
- `academics.js`: reference data (departments, courses, sections, subjects, sections list) — used by frontend pickers.
- `profile.js`: `/api/profile` (GET/PUT own profile).
- Wired all routers into `server/index.js` (see mount block at ~lines 84-96) and created `server/lib/db.js` + `server/middleware/auth.js` (`authRequired`, `requireRole(...roles)`, `getStudentForAuth`, `getTeacherForAuth`).

**Frontend**:
- `src/lib/api.js`: `apiFetch` wrapper — attaches Supabase access token as `Bearer`, JSON handling, error normalization; exposes `api.get/post/put/delete`.
- `src/pages/StudentDashboard.jsx`: tabs Overview / Attendance (per-subject %) / Marks / Timetable.
- `src/pages/TeacherDashboard.jsx`: tabs Overview / My Classes / Mark Attendance (status buttons per student, save) / Enter Marks (assessment + section picker, max-validated) / Assessments (create + list) / Schedule.
- `src/pages/Unauthorized.jsx` + `/unauthorized` route; role-based Dashboard link in `Navbar.jsx`; protected routes in `App.jsx`.

### 4.2 Phase 4 — News Infrastructure ✅
Schema tables already existed (`news_sources`, `news_items` — see `supabase/schema.sql` lines ~341-376). Built:
- **`server/routes/news.js`**:
  - Public: `GET /api/news` (filters `page`, `limit`, `category`, `q`; returns `{ data, page, limit, total }`; only `is_published = true`, newest first, `news_sources` joined), `GET /api/news/sources` (active sources).
  - Admin (`authRequired` + `requireRole('admin','super_admin')`): `GET/POST /api/news/admin/items`, `PUT /api/news/admin/items/:id` (edit), `PUT .../verify` (`verified|rejected|flagged|pending`), `PUT .../publish` (`isPublished` bool), `DELETE .../:id`, `GET/POST /api/news/admin/sources`.
- **`src/pages/NewsPage.jsx`** (`/news`, public): category chips, search, skeleton loading, load-more, "via {source}" + external link cards.
- **`src/pages/AdminNews.jsx`** (`/admin/news`, admin-only): tabs News Items / Sources. Items tab: filters (verification, published, category, search), inline create, inline edit, verify/reject/flag, publish/unpublish, delete. Sources tab: add/toggle sources.
- **`src/components/NewsTicker.jsx`**: rewritten to fetch `GET /api/news?limit=8` and render live titles with graceful fallback to static defaults; `<Navbar/>` now imports it (removed its old duplicate inline copy) and a **News** nav link was added.

### 4.3 Phase 5 — AI News Agent ✅
- **`server/lib/ai.js`**: classification helper. Uses OpenAI `gpt-4o-mini` when `OPENAI_API_KEY` is set; otherwise deterministic keyword-heuristic fallback. Never throws.
- **`server/lib/agentEngine.js`**: one agent cycle — pick sources due by `check_frequency_hours` / `last_checked_at`, fetch with timeout, extract candidate links + titles (regex, no extra deps), strip HTML, filter same-origin, sha256 `content_hash` dedup, insert into `news_items` as `verification_status='pending'` + `is_published=false` (admin reviews), update source `last_checked_at`, and log everything to `ai_agent_runs` + `ai_agent_events`.
- **`server/lib/scheduler.js`**: background loop, interval = `AGENT_INTERVAL_MINUTES` (default 60; `0` disables). Overlap guard so cycles can't stack. Boots with the server (verified in startup log).
- **`server/routes/agent.js`** (admin-guarded): `GET /api/agent/status` (mode, scheduler state, pending-review count, source stats), `POST /api/agent/run` (run full cycle now), `POST /api/agent/run-source/:id` (single source), `GET /api/agent/runs` (history + events).
- **`src/pages/AdminAgent.jsx`** (`/admin/agent`, admin-only): status cards (AI mode / scheduler / pending review / active sources), "Run agent now" + per-source "Check now", expandable run history with event timelines. Route added to `App.jsx` with admin/super_admin guard.

### 4.4 Verification performed (per phase)
- `node --check` on every touched server file (all pass).
- `npm run build` passes (only warning: chunk-size hint — see §6).
- Live smoke tests (server on port 3999): public `GET /api/news` → 200; protected endpoints (`/api/agent/status`, `/api/news/admin/*`, dashboards) → 401 without token (proving routers mounted + auth enforced); scheduler startup log confirmed.

## 5. What's Left (Recommended Order)

### 5.1 Phase 6 — Notification Engine (per IMPLEMENTATION_AUDIT.md)
1. **Notification DB**: check `supabase/schema.sql` for `notifications` / `notification_preferences` tables (they exist in the schema plan — verify & apply to Supabase if not yet run).
2. **Targeting**: role-based AND user-based recipients (reuse `profiles.role`; announcements already carry `target_audience TEXT[]`).
3. **Preferences**: per-user settings (mute categories, channels).
4. **Queue**: background worker pattern — copy the Phase 5 approach (`server/lib/scheduler.js` style loop + runs/events tables) rather than adding a new queue dependency.
5. **Delivery**: in-app first (bell icon + `/notifications` page); email via Supabase/Resend later.
6. Suggested triggers to wire: attendance marked, marks published, announcement published, agent publishes news (reuse review flow), timetable changes.

### 5.2 Phase 7 — AI Assistant
1. Chat UI (floating panel or `/assistant` page) using existing `src/lib/api.js`.
2. Server `server/routes/assistant.js` + tool layer with **controlled, whitelisted tools**: attendance/marks/timetable lookups scoped to `req.profile` (reuse `getStudentForAuth`/`getTeacherForAuth`), news search.
3. Source citations in answers (news items have `url`; agent runs/events are queryable).
4. Reuse `server/lib/ai.js` (OpenAI when key present; degrade gracefully without).

### 5.3 Data & ops gaps (small but real)
- **Seed data**: no seed script found. Dashboards render empty states until sections/subjects/enrollments/timetable/assessments exist. A `supabase/seed.sql` (or admin UI CRUD) is the highest-value quick win.
- **RLS**: server uses service role (bypasses RLS) — verify RLS policies in Supabase for direct client-side queries (frontend also uses anon key for some reads).
- **Frontend chunk warning**: single large chunk on build — add route-level `React.lazy()` when convenient.
- **Legacy monolith**: `server/index.js` still contains old inline handlers below the modular mounts. Safe to delete gradually once nothing depends on them.
- **News sources seeding**: add 2-3 real sources (college/university sites) via Admin → Agent page so the agent has something to monitor.

## 6. Gotchas / Coordination Notes

- **Parallel actors**: during Phases 4-5 another tool committed my staged files as `1f0fdea` mid-flight. Coordinate: one driver per phase, `git pull --rebase` before committing.
- **Never commit `.env`** (gitignored; contains service-role key). Rotation policy: if it ever lands in a commit, rotate the key in Supabase immediately.
- **Roles**: `student | teacher | admin | super_admin` (enforced server-side in `middleware/auth.js`; UI checks are convenience only).
- **Mounted-router precedence**: modular routers are mounted BEFORE legacy handlers in `index.js` — keep new routes in `server/routes/`, don't add inline handlers to the monolith.
- **Agent safety**: engine only crawls URLs from `news_sources`, same-origin links only, dedup via `content_hash`, everything lands in review queue — don't weaken these guards.
- **Schema truth**: `supabase/schema.sql` is the source of truth; several tables (notifications, etc.) are defined there but not yet used by code.

## 7. Quick Sanity Checklist for the Next Session
```bash
cd college-website && npm run build          # must pass
cd server && node index.js                   # boots, mounts routers, starts scheduler
# without a token:
curl http://localhost:3001/api/news          # 200 {"data":[],...}
curl http://localhost:3001/api/agent/status  # 401 (auth enforced)
```
Then `git pull --rebase origin main` before starting any new work.


