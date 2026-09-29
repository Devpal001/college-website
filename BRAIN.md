# BRAIN.md — MBSCET College Digital Platform

> **Living system map.** Read this first, then trust the implementation over this file.
> Production baseline: commit `4269d62` (2026-09-04). Current HEAD: `97cfbec`
> (2026-09-17, == origin/main). Uncommitted: `BRAIN.md` doc-only sync (this file).
> Everything below describes HEAD + the working tree.

---

## 1. Project Overview

`BRAIN.md` is a project map for future developers AND the owner (who vibe-coded much of this).
Records what the system **actually is**, not aspirations. Implementation is source of truth.

### What it does
A role-based college platform: public marketing site + authenticated academic portal +
AI-powered news discovery + AI chat assistant + in-app notifications.

### Users
- **Prospective students** — public pages (home, admissions, departments)
- **Students** — attendance, marks, timetable, notices, notifications
- **Teachers** — class lists, attendance/marks entry, schedule
- **Admins** — news review/publish, AI agent monitoring, user provisioning
- **Super-admins** — full access (same as admin in this build)

### Features
- React 19 + Vite frontend (Tailwind, React Router v7)
- Email/password auth via Supabase GoTrue (production)
- Demo "portal ID" login (dev/test only — fail-closed in production)
- Role-based dashboards (student/teacher/admin)
- Attendance marking & viewing
- Marks entry & reporting
- Timetable display
- News feed (admin-reviewed, AI-discovered sources)
- AI News Agent (scheduler + crawler + classifier + review queue)
- AI Assistant (chat, role-scoped tools, rate-limited)
- In-app notifications (bell + list page)

### Production status
**PRODUCTION DEPLOYED — POST-LAUNCH WORK COMMITTED** (HEAD `97cfbec`, == origin/main).
- Vercel: `https://college-website-psi-seven.vercel.app` — live
- Render: `https://college-website-api.onrender.com` — live

---

## 2. Project Progress (7-Phase Roadmap)

Original roadmap: **7 phases. All complete.**

| Phase | Name | Goal | Status | Completion |
| ----- | ---- | ---- | ------ | ---------: |
| 1 | Audit & Architecture Mapping | Audit monolith, map architecture | ✅ Complete | 100% |
| 2 | Backend Foundation | Schema, RBAC, API, auth middleware | ✅ Complete | 100% |
| 3 | Academic Platform | Dashboards, attendance, marks, timetable | ✅ Complete | 100% |
| 4 | News Infrastructure | News model, admin console, feed, sources | ✅ Complete | 100% |
| 5 | AI News Agent | Scheduler, engine, classification, review | ✅ Complete | 100% |
| 6 | Notification Engine | Notifications, triggers, bell UI | ✅ Complete | 100% |
| 7 | AI Assistant | Chat UI, scoped tools, rate limit | ✅ Complete | 100% |

### Future Work (separate from phases)
| Item | Type | Notes |
| ---- | ---- | ----- |
| Email delivery | Future Feature | env scaffolding exists (`SMTP_*`, `VAPID_*`); not wired |
| 20 pending news items | Maintenance | 5 published; 20 await review |
| Legacy cleanup | Maintenance | demo login path; `signInWithPortalId` |
| UI polish | Enhancement | per `DESIGN_SYSTEM.md` — desktop pass done (§2); mobile/responsive pass pending |

> Phase 8 does not exist in the original plan.

### Post-Launch Polish Pass (2026-09-05) — COMMITTED

Desktop visual QA + one auth-redirect fix. 8 frontend files, no new dependencies, no API/DB
changes. Committed as `188bb6a` + `6bfad3e` + `6f4e179`/`a7fc720`/`f7a327c`.

**UI fixes (CSS classes only — Home, Admissions, About, Departments, Gallery, NewsPage, Footer):**
- Paragraphs in `text-center` sections that were left-stranded by the global
  `p { max-width: 75ch }` rule are centered with `mx-auto` (Home hero accreditation line +
  CTA "Applications for the next intake…", Admissions CTA, About "Our Story",
  Departments M.Tech notes, NewsPage empty state, Login header).
- ⚠️ **Tailwind v4 layering gotcha (discovered during this pass):** unlayered rules in
  `index.css` (`p { max-width: 75ch }`, `h1`–`h4` font clamps) **override utility classes**
  (`max-w-*`, `text-*`) on those elements, because unlayered author CSS beats `@layer
  utilities`. Account for this in future UI work.
- Vertical rhythm normalized to the spacing tokens: `py-32` → `py-24` (`--space-12`) on Home
  hero/highlights/CTA and the Departments/Gallery headers; removed an empty `#stats` anchor
  section on About (~144px dead space); Footer `mt-16` → `mt-8`.
- No responsive restructuring — all changes are fluid and mobile-safe. Full mobile
  optimization remains a separate future phase.
- Neumorphism stays intentionally removed: shadow tokens are flattened app-wide
  (`--shadow-*: none` in `index.css`, per DESIGN_SYSTEM §1). Do not reintroduce.

**Login redirect fix (`src/pages/Login.jsx` — auth behavior only):**
- Email login previously called `navigate('/')` on success, racing the session-aware redirect
  on `/login` (which guessed `role || 'student'`) — users could land on the home page or the
  wrong dashboard. It now resolves the profile via `getCurrentProfile` (`GET /api/auth/me`)
  and navigates to `dashboardPathForRole(profile.role)`, matching the institutional login contract.
- The session-aware redirect on `/login` fires only once the role is known
  (`user && profile`); it no longer guesses a role.
- Errors still render inline (no error flow navigates anywhere). Auth libs, server routes,
  DB schema, and API contracts untouched.

**Known leftovers (2026-09-05 note; resolved/changed since — see §2 "Since baseline"
and §10):** footer panel was invisible in both themes at the time; 3 pre-existing
lint errors existed at the time (2 in `server/routes/*`, 1 unused `LoadingSpinner`
import in `AdminDashboard.jsx`). Current lint state: `npm run lint` passes clean at HEAD.

### Since baseline `4269d62` → HEAD `97cfbec` (2026-09-05 → 2026-09-17, committed)

Post-launch hardening + UX. Headline changes (75 files, +8178/−1156):

- **Institutional auth (production path):** `POST /api/auth/login` — institutional ID +
  password, isolated session client (`createSessionAuthClient`), fail-closed demo gate;
  migrations `2026_09_05_phase0/phase1/phase2`; `ActivateAccount.jsx` (registry activation);
  `Login.jsx` is now portal-first (institutional ID+password primary, email secondary,
  dev-only demo fallback); `/signup` redirects to `/activate`; `Signup.jsx` removed.
- **Admin provisioning:** `server/routes/users.js` — teacher assignment + registry
  (`POST /api/users/registry`, reissue), `AdminUsers.jsx` registry UI.
- **Timetable system:** full CRUD (`server/routes/timetable.js`), `AdminTimetable.jsx`,
  `TimetableGrid.jsx`; `TeacherDashboard`/`StudentDashboard` integration.
- **Public-form hardening (2026-09-16, `e3770da`):** `server/routes/public.js`
  (`POST /api/admissions`, `POST /api/contact`, shared rate limiter), `server/lib/rateLimit.js`,
  `server/lib/academics.js` (shared attendance/marks rules), `src/lib/sessionStore.js` +
  `GET /api/auth/me` (single server-side role resolution; browser no longer reads
  `profiles` directly), `src/lib/format.js` (`getInitials`), `useTabParam` hook,
  migration `2026_09_16_public_form_tables.sql` (`messages` table), backup tooling
  (`scripts/export-data|restore-data|verify-data|tables.mjs`, `docs/BACKUP_MIGRATION.md`,
  `docs/INDUSTRIAL_AUDIT.md`), CI workflow (`.github/workflows/ci.yml`).
- **Frontend UX (2026-09-12 → 17):** scroll animations (`useScrollAnimation`),
  responsive navbar morph + soft-UI shadows w/ dark-mode (`Navbar.jsx`, `index.css`),
  `PortalProfile.jsx` overhaul, `Gallery`/`PhotoCarousel` fixes.
- **Housekeeping:** `_tmp_check.mjs` (repo-root debug probe, committed — see §10
  cleanup note), `scripts/audit-rls.mjs` removed, `render.yaml` build/start clarified,
  `data/` snapshots gitignored (never commit real user data).

---

## 3. Architecture

```text
Browser (Vercel)            Render Backend              Supabase
 ─────────────────           ─────────────────           ─────────
 React 19 SPA                Express API server          Auth (GoTrue)
 src/                        server/index.js             PostgreSQL
 vite dev                    server/routes/*.js          Row Level Security
 │                          server/middleware/auth.js   server/lib/db.js (svc-role)
 /api/* → same-origin        /api/* served here           │
 (proxy → Render in prod)   (service key bypasses RLS)

Browser DB reads are the exception, not the rule: only the login session handshake
uses Supabase JS directly; every piece of application data (including the role via
`GET /api/auth/me`) comes from the Express API. Direct `profiles` reads were removed
from `Navbar`/`useAuth`/`Login` (2026-09-16, `e3770da`).
```

**Production path:** Browser → `/api/...` on Vercel → Vercel rewrites to Render → Express uses
Supabase **service-role key** (bypasses RLS).

**Two Supabase clients:**
1. **Browser** (`src/lib/supabase.js`) — anon key — session handshake only (all
   application data comes from `/api`; no component reads `profiles` directly).
2. **Server** (`server/lib/db.js`) — service-role key — bypasses RLS; server-side only,
   **never imported by frontend**. Institutional login additionally uses a
   request-scoped session client (`createSessionAuthClient`), never the shared DB client.

---

## 4. Repository Map

```
college-website/
├── src/
│   ├── App.jsx               # Routes — lazy-loaded page chunks
│   ├── main.jsx              # Entry; pre-paint theme prevents flash
│   ├── index.css             # Design tokens (:root + html.dark)
│   ├── components/           # Navbar, AIAssistant, ProtectedRoute,
│   │                          NewsTicker, NotificationBell, PortalLayout, Gallery
│   ├── pages/                # Home, Login, ActivateAccount, Student/Teacher/Admin Dashboard,
│   │                          AdminNews, AdminAgent, AdminUsers, AdminTimetable, News, Notifications
│   ├── hooks/                # useAuth.jsx (NOTE: .jsx not .js), useScrollAnimation, useTabParam
│   ├── lib/                  # api.js, auth.js, supabase.js, sessionStore.js, format.js, notificationFormat.js
│   └── assets/
├── server/
│   ├── index.js              # Entry — routers, CORS, errors, scheduler
│   ├── package.json
│   ├── middleware/auth.js    # authRequired, requireRole, role scoping
│   ├── lib/                  # db.js (svc-role), ai.js, agentEngine.js,
│   │                          │  scheduler.js, httpError.js, validate.js, rateLimit.js,
│   │                          │  academics.js, password.js, activation.js
│   └── routes/               # academics, auth, profile, records, students,
│                              # teachers, timetable, news, agent, notifications,
│                              # assistant, users, public
├── supabase/
│   ├── schema.sql            # Full schema + RLS + seed data
│   └── migrations/           # Phase 0/1/2 identity + H-1 RLS fix + 2026-09-16 public-form tables
├── scripts/                  # seed-demo.mjs, backup/restore/verify-data, test-*.mjs suites,
│                             # verify-timetable-smoke.mjs, probe-*.mjs, status.mjs
├── docs/
│   ├── BACKUP_MIGRATION.md   # Backup/migration/portability guide (2026-09-16)
│   └── INDUSTRIAL_AUDIT.md   # Industrial refactor audit (2026-09-16)
├── .github/workflows/ci.yml # CI: lint + build + auth-gate regression (push/PR to main)
├── public/
├── vercel.json               # Rewrites /api → Render; security + cache headers
├── render.yaml               # Blueprint: Node, health check, CORS
├── .env.example              # Variable names only
├── .gitignore
├── HANDOFF.md                # Historical (some stale)
├── IMPLEMENTATION_AUDIT.md   # Phase 1 audit source-of-truth
├── DESIGN_SYSTEM.md          # UI/UX guidelines
├── PHASE2_SETUP_GUIDE.md     # Setup steps (partly stale)
└── README.md                 # Vite default
```

**Reconciled docs notes:**
- `PHASE2_SETUP_GUIDE.md` references `useAuth.js` — actual is `useAuth.jsx`.
- `HANDOFF.md` "What's Left" is stale (work now done). Historical only.

---

## 5. Technology Stack

| Layer | Tech | Purpose | Where | Learn |
|-------|------|---------|-------|-------|
| Frontend | React 19 + Vite 8 | Fast HMR, JSX, lazy chunking | `src/`, `vite.config.js` | JSX, hooks, `lazy`/`Suspense` |
| Styling | Tailwind CSS 4 | Utility classes + design tokens | `src/index.css` | CSS vars, utility classes |
| Routing | React Router v7 | Nested routes, data loading | `src/App.jsx` | `Routes`/`Route`, `Navigate` |
| Icons | lucide-react | Icon set | components | `size` prop |
| State | React hooks | No Redux — hooks + API | `hooks/`, `lib/api.js` | async fetches |
| Auth (client) | Supabase JS (anon key) | GoTrue sessions | `lib/supabase.js`, `lib/auth.js` | JWT, `signInWithPassword` |
| Auth (server) | Express middleware | Validates JWT server-side | `middleware/auth.js` | Bearer tokens, roles |
| Backend | Node 20 + Express | API layer; svc-role DB | `server/` | Routing, middleware |
| Database | Supabase Postgres | Authenticated storage | `supabase/schema.sql` | Postgres, RLS, `auth.uid()` |
| AI | OpenAI (optional) | News classification + chat | `server/lib/ai.js` | chat completions API |
| Hosting | Vercel | Static frontend + proxy | `vercel.json` | Rewrites, security headers |
| API host | Render | Express server (free tier) | `render.yaml` | Web services, health checks |

---

## 6. Feature Map

**Authentication** — Prod: institutional ID+password (`POST /api/auth/login`) primary;
email/password secondary; demo portal-ID login dev-only (fail-closed). Frontend:
`src/lib/auth.js`, `src/hooks/useAuth.jsx`, `ProtectedRoute.jsx`, role from
`GET /api/auth/me` (`sessionStore.js`). Backend: `server/routes/auth.js`. Middleware:
`server/middleware/auth.js`. DB: `profiles` (role). Verified ✅ all 3 roles login.

**Student Portal** — `StudentDashboard.jsx`; `students.js`, `records.js`; DB: `students`, `enrollments`, `attendance`, `marks`, `timetable`, `subjects`. Verified ✅ dashboard + tabs.

**Teacher Portal** — `TeacherDashboard.jsx`; `teachers.js`, `records.js`; DB: `teachers`, `teacher_subjects`, `attendance_sessions`, `marks`. Verified ✅ dashboard + marks-trigger.

**Admin Portal** — `AdminDashboard.jsx`, `AdminNews.jsx`, `AdminAgent.jsx`, `AdminUsers.jsx`
(registry + provisioning UI), `AdminTimetable.jsx` (full timetable CRUD); `users.js`,
`timetable.js`, `news.js`, `agent.js`. Verified ✅ news publish + agent monitoring.

**Public forms (hardened 2026-09-16)** — Admissions/Contact pages POST to
`POST /api/admissions` + `POST /api/contact` (`server/routes/public.js`, shared rate
limiter `server/lib/rateLimit.js`). Browser no longer writes `admissions`/`messages`
directly; `messages` table captured in migration `2026_09_16_public_form_tables.sql`.

**News** — `NewsPage.jsx` (public), `AdminNews.jsx` (admin); `news.js`; DB: `news_items`, `news_sources`. Feed `GET /api/news` anon-allowed. 5 live items. Verified ✅.

**AI News Agent** — `AdminAgent.jsx`; `agent.js`, `agentEngine.js`, `scheduler.js`; DB: `ai_agent_runs`, `ai_agent_events`. 60-min + boot catch-up. Verified ✅ scheduler firing.

**AI Assistant** — `AIAssistant.jsx`; `assistant.js`; role-scoped tools. 10 req/min + 4000-char cap. Verified ✅ authenticated chat live.

**Notifications** — `NotificationBell.jsx`, `Notifications.jsx`; `notifications.js`; DB: `notifications`, `notification_preferences`. Triggers with M-1 scoping. Email NOT WIRED. Verified ✅ marks-notification visible live.

---

## 7. User Flows

### Authentication (production)
```text
User → /login → portal form (institutional ID + password) → POST /api/auth/login
 → Supabase GoTrue issues session → useAuth.jsx sets session + profile (via GET /api/auth/me)
 → ProtectedRoute → correct dashboard → Navbar/PortalLayout use session+role → logout clears session

Legacy secondary flow: email/password form → signInWithEmail() → GoTrue JWT (same
session/profile routing afterwards). Dev-only: password-less demo login
(signInWithPortalId), fail-closed in production.
```

Post-login routing is deterministic: `Login` resolves the profile (portal login returns
it from the API; email login probes `GET /api/auth/me`), then navigates to
`dashboardPathForRole(profile.role)` (fixed 2026-09-05 — see §2 polish pass).

### Account provisioning model & dashboard error states (2026-09-05)

### Account provisioning model & dashboard error states (2026-09-05; self-signup retired — Decision 3)

- Public self-signup is RETIRED: `/signup` redirects to `/activate`
  (`src/pages/ActivateAccount.jsx`); `Signup.jsx` was removed. A person can only
  activate an identity the administration has already registered.
- Administrative provisioning paths: `POST /api/users/admin` (complete active account:
  auth user → profile → role row) and `POST /api/users/registry` (pending registry
  account + one-time activation code). Dev seed script also provisions records.
- Single identifier chain: `auth.users.id === profiles.id === students.profile_id /
  teachers.profile_id`. There is no second identity system and no identifier mismatch.
- `getStudentForAuth` / `getTeacherForAuth` (`middleware/auth.js`) distinguish outcomes:
  zero role rows → 404 + code `STUDENT_PROFILE_MISSING` / `TEACHER_PROFILE_MISSING`
  (honest "record not linked yet" dashboard state, no retry button); database/service
  failure → 500 + code `*_LOOKUP_FAILED` (retryable, logged server-side). DB errors are
  never reported as "profile not found". No error flow redirects to the public home page.

### Phase 0 — Identity foundations (2026-09-05, migration `2026_09_05_phase0_identity_foundations.sql`)

- `profiles.institutional_id TEXT UNIQUE` — the unified human-facing institutional
  identity. Backfilled deterministically from `students.enrollment_number` /
  `teachers.employee_id` (existing values preserved, nothing renamed). Administrator
  institutional IDs are assigned through the authoritative provisioning/registry
  process — they are not invented by the migration.
- `profiles.status` — `pending | active | suspended | disabled` (NOT NULL, DEFAULT
  `active` so legacy trigger-created accounts keep working during the transition;
  existing rows backfilled to `active`). The legacy `is_active` boolean is preserved
  and kept synchronized by the `sync_profile_status()` trigger; `status` is the
  authoritative lifecycle field.
- Phase 0 is purely additive: application behavior is unchanged. `authRequired` status
  enforcement lands in Phase 3; registry/activation flows in Phase 1; unified
  institutional login in Phase 2.

### Phase 1 — Identity registry + account activation (2026-09-05, migration `2026_09_05_phase1_account_activations.sql`)

- **Public self-signup is RETIRED (Decision 3):** `/signup` redirects to `/activate`
  (`src/pages/ActivateAccount.jsx`); `Signup.jsx` was removed. A person can only activate
  an identity the administration has already registered.
- **Registry (admin-only, Phase 1):** `POST /api/users/registry` creates the authoritative
  identity as a COMPLETE pending account — auth user (random unusable password) → profile
  (`status='pending'`, `institutional_id`) → students/teachers row (the institutional ID
  doubles as enrollment/employee code) → one-time activation code (SHA-256 hash in
  `account_activations`, single-use, 7-day TTL). The raw code is shown once in the
  AdminUsers UI ("Registry activation" checkbox) and delivered out-of-band.
  `POST /api/users/registry/reissue` replaces an unused code. The ROLE always comes from
  the registry entry — the person never chooses one.
- **Activation (public, rate-limited):** `POST /api/auth/activate` verifies institutional
  ID + institutional email + one-time code (+ the shared password policy,
  `server/lib/password.js`) and flips the account `pending → active`, burning the code.
  Every rejection returns ONE generic message (`ACTIVATION_FAILED`) — no enumeration;
  specifics are logged server-side only. Code comparison is timing-safe against the
  stored hash; passwords are handled exclusively by Supabase GoTrue.
- **`account_activations` table:** RLS deny-by-default — anonymous/authenticated clients
  have NO policy (no access). The Express API's server-side `service_role` is granted
  access through one `--privileged` `FOR ALL` policy (required for non-owner tables;
  privilege is not granted to browsers).
 - **Transitional state:** pending accounts cannot authenticate (unknown random password;
   demo-login checks `status != 'active'`). Legacy email/password login is preserved for
   active accounts (Decision 5). Phase 2 unified institutional-ID login and Phase 3
   (`authRequired` status enforcement + frontend `signInWithEmail` status gate) are implemented.
- E2E verification script: `node scripts/test-activation.mjs` (self-cleaning — creates and
  deletes one `TEST-ACT-STU` identity; requires the dev server + demo seed).

### Student → StudentDashboard → overview/attendance/marks/timetable → GET /api/students/me/dashboard
### Teacher → TeacherDashboard → dashboard/classes/attendance/marks entry → POST /api/marks (scoped)
### Admin → AdminDashboard → News/AI Agent/Users → publish news → live feed updates

### Notifications
```text
Trigger (records.js/news.js) → createNotificationForUsers()
 → notifications table → bell icon + /notifications page (polls every 30s)
```

### AI Assistant
```text
User clicks Bot → AIAssistant panel → POST /api/assistant/chat
 → classify intent → call role-scoped tool(s) → {response, sources, classification}
 → admin-only summary logged to ai_agent_runs
```

### AI News Agent
```text
scheduler.tick() [60 min + boot catch-up]
 → runAgentCycle() → ai_agent_runs(running)
 → checkSource() fetch → extract → classify → insert news_items(pending)
 → update source.last_checked → run completed/failed
```

---

## 8. Data Flow

```text
Browser
 ↓ (React event)
api.js fetch (Bearer JWT from session)
 ↓ (same-origin /api/ OR Vercel proxy → Render)
Vercel → Render → server/index.js
 ↓
middleware/auth.js → validates JWT → req.user, req.profile (role)
 ↓
route handler (records.js, assistant.js, etc.)
 ↓ scoped query via server/lib/db.js (svc-role — bypasses RLS)
 ↓ authorization (isTeacherAssigned, enrollment checks, M-1 scoping)
 ↓
response (data OR { error, code } via httpError.js)
 ↓
Browser renders UI
```

**Two Supabase clients:** Browser uses anon key (RLS-gated reads); Server uses service-role key (bypasses RLS, never in frontend).

---

## 9. AuthN vs AuthZ

- **Authentication = who you are**: email/password → Supabase GoTrue → JWT session.
- **Authorization = what you can do**: role (`student`/`teacher`/`admin`/`super_admin`) checked
  **server-side** by `authRequired`+`requireRole` and RLS policies. Frontend role checks are
  **convenience only** — the backend is always authoritative.

---

## 10. Security Model

| Mechanism | Protects | Where | Notes |
| --------- | -------- | ----- | ----- |
| Supabase GoTrue auth | Identity/session | Frontend `lib/auth.js`; backend `middleware/auth.js` | JWT validated server-side |
| Role authorization | Role-based access | `middleware/auth.js requireRole` | Server-side; frontend is convenience |
| RLS | Row-level data isolation | `supabase/schema.sql` + live Supabase | Service-role bypasses on server; anon client relies on RLS |
| `ai_agent_runs` H-1 fix | AI run data leak (was public SELECT) | `supabase/migrations/2026_09_01_fix_rls_policies.sql` | anon count = 0; admin = 64 (verified) |
| M-1 notification scoping | Teacher can't message other sections | `notifications.js`, `records.js` | Requires subjectId+sectionId + enrollment |
| M-2 chat limits | Abuse/payload storage | `server/routes/assistant.js` | 10/min/user; 4000-char cap; no payload persistence |
| CORS | Cross-origin API access | `server/index.js` + `render.yaml` + `vercel.json` | Allow-list; fail-closed |
| Security headers | Browser-level attacks | `vercel.json` | HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| Demo login gate | Accidental ID-only login in prod | `server/routes/auth.js` + `render.yaml` | Fail-closed; `DISABLE_DEMO_LOGIN=true` in prod |
| Service-role isolation | Secret key exposure | `server/lib/db.js` + `.env` gitignored | NEVER imported by frontend |
| Error sanitization | DB/internal leakage | `server/lib/httpError.js` + global handler | Generic messages to client |
| Account status enforcement | Non-active account access | `middleware/auth.js` + `server/routes/auth.js` | `pending`/`suspended`/`disabled` blocked on login and protected API |

---

## 12. Environment Variables (names only — never commit values)

| Variable | Purpose | Where Used | Required | Secret |
| -------- | ------- | ---------- | -------- | ------ |
| `VITE_SUPABASE_URL` | Supabase project URL | frontend + server | Yes | No (public) |
| `VITE_SUPABASE_ANON_KEY` | Browser anon key (RLS-gated) | frontend | Yes | No (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS (server-only) | `server/lib/db.js` | Yes | Yes |
| `OPENAI_API_KEY` | AI classification + chat | `server/lib/ai.js` | No | Yes |
| `OPENAI_MODEL` | Chat model | `server/lib/ai.js` | No | No |
| `OPENAI_TEMPERATURE` | Model temperature | `server/lib/ai.js` | No | No |
| `OPENAI_MAX_TOKENS` | Max response tokens | `server/lib/ai.js` | No | No |
| `VITE_API_URL` | Frontend API base override | `src/lib/api.js` | No | No |
| `VITE_APP_NAME` | App name | root config | No | No |
| `VITE_APP_URL` | App URL (dev) | config | No | No |
| `VITE_APP_PRODUCTION_URL` | Production URL | config | No | No |
| `VITE_DEBUG` | Debug logging flag | frontend | No | No |
| `VITE_ENABLE_*` | Feature flags | frontend | No | No |
| `VITE_USE_MOCK_DATA` | Mock data flag | frontend | No | No |
| `VITE_SUPABASE_URL` | Browser client URL | `src/lib/supabase.js` fallback | Yes | No |
| `DEMO_ADMIN_IDS` | Demo admin email mapping | `server/routes/auth.js` | No | No |
| `DISABLE_DEMO_LOGIN` | Kill switch demo login | `server/routes/auth.js` | No | No |
| `DEMO_LOGIN_ENABLED` | Explicit demo opt-in | `server/routes/auth.js` | No | No |
| `AGENT_INTERVAL_MINUTES` | Scheduler interval | `server/lib/scheduler.js` | No | No |
| `SESSION_TIMEOUT_HOURS` | Session lifetime | config | No | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `server/index.js` | No | No |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit max | `server/index.js` | No | No |
| `CHAT_MAX_PER_WINDOW` | Chat rate limit/min | `server/routes/assistant.js` | No | No |
| `MAX_FILE_SIZE_MB` | Upload limit | config | No | No |
| `SMTP_*` / `VAPID_*` | Email delivery (unused) | — not wired | No | Yes |
| `NODE_ENV` | Environment | server + frontend | Set to `production` in prod | No |
| `PORT` | Server port | `server/index.js` | No | No |
| `CORS_ORIGINS` | Extra CORS origins | `server/index.js` | No | No |

---

## 13. Deployment Architecture

### GitHub
- Single `main` branch. Logical commits. `.env` gitignored; `.env.example` has placeholders.

### Vercel (frontend)
- Builds `npm run build` → static bundle (`dist/`).
- `vercel.json`:
  - Rewrites `/api/:path*` → `https://college-website-api.onrender.com/api/:path*`.
  - Rewrites `/(.*)` → `/index.html` (SPA fallback).
  - Headers: immutable cache on `/assets/*`, no-cache on HTML, security headers.

### Render (backend)
- `render.yaml` blueprint — Node, builds root + server deps.
- `startCommand: node server/index.js`, `healthCheckPath: /health`, `autoDeploy: true`.
- Service name: `college-website-api` (matches live hostname `college-website-api.onrender.com`).
- Env (in Render dashboard, never committed): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
- Production env: `DISABLE_DEMO_LOGIN=true`, `NODE_ENV=production`, `CORS_ORIGINS=https://college-website-psi-seven.vercel.app`.
- Scheduler runs inside the same process.

### Supabase
- Single project (`knqirwyslekuiplagvvi`).
- Schema: `supabase/schema.sql` (authoritative).
- Migrations: `supabase/migrations/` (H-1 RLS fix).
- Seed: `scripts/seed-demo.mjs`.

---

## 14. Operational Workflows

### Local development
```bash
npm install
npm install --prefix server
cp .env.example .env   # fill required values
npm run seed           # idempotent seed data
npm run dev            # Vite (frontend, proxy /api → localhost:3001)
npm run server         # Express backend (separate terminal)
```

### Build
```bash
npm run build
```

### Testing (focused)
```bash
npm run build                         # frontend
node server/index.js                  # boots: /health 200 + scheduler log
curl /api/news                        # 200 (anon)
curl /api/agent/status                # 401 (auth enforced)
```

### Git (safe workflow)
```bash
git pull --rebase origin main
git add <specific files>
git commit -m "short scoped message"
git push origin main
```

### Deployment
- Frontend: push `main` → Vercel auto-deploys; or `vercel --prod` (requires Vercel CLI + login).
- Backend: push `main` → Render auto-deploys.
- CI: GitHub Actions runs on push/PR to `main` (lint, build, auth regression tests). CI does **not** currently block production deployment unless branch protection / required checks are separately configured.

### Database changes
- Edit `supabase/schema.sql`, apply to Supabase (dashboard or migration), commit migration file.

### AI News Agent
- Runs automatically (60-min + boot catch-up).
- Manual trigger: `POST /api/agent/run` (admin only).
- Monitor: Admin → AI Agent page.

---

**Commit:** `97cfbec` (HEAD == origin/main) · Working tree: 1 modified file (`BRAIN.md` doc-only, uncommitted) · Pushed ✅

| System | Status |
|--------|--------|
| Vercel | ✅ Live — `college-website-psi-seven.vercel.app` |
| Render | ✅ Live — `college-website-api.onrender.com` |
| Supabase | ✅ Live — RLS active, anon `ai_agent_runs` = 0 |
| Auth (student/teacher/admin) | ✅ Verified live (email/password, fail-closed demo) |
| Dashboards | ✅ Student/Teacher/Admin all verified live |
| Attendance, marks, timetable | ✅ Verified live |
| AI Assistant | ✅ Verified (scoped tools, rate limit, length cap) |
| Notifications | ✅ Verified (marks trigger → visible in-app) |
| News | ✅ Verified (5 items live, public feed populated) |
| AI News Agent | ✅ Verified (scheduler firing, 25 items generated) |
| CORS | ✅ Allow-list active, Vercel domain allowed |
| Security headers | ✅ Active on Vercel |
| Git | ✅ `97cfbec` pushed, `HEAD == origin/main` |

**Known limitations (non-blocking):**
- Email notifications: NOT WIRED (optional future feature)
- AI uses keyword heuristics when no `OPENAI_API_KEY` (optional)
- 20 pending news items await manual review (content, not a bug)
- Public self-signup retired: `/signup` redirects to `/activate`. Admin-provisioned
  accounts whose academic record is not linked yet see an honest "record not linked"
  dashboard state (by design — see §7)

---

## 15. Change Impact Map

If this changes → check these → verify minimum:

```text
Auth change      → login(3 roles) • protected API 401 • logout
DB/RLS change    → CRUD • unauthorized • anon/student/teacher/admin
News change      → publish → public feed + ticker
AI chat change   → chat (200) • 11th msg/min (429) • >4000 chars (400)
Notification     → trigger → student bell + /notifications • M-1 scoping
Scheduler change → run logged → news_items created
Frontend change  → npm run build (PASS) → deployed site loads
CORS/header      → curl preflight → allow-origin → headers present
Deploy change    → frontend 200 + /health 200 + /api proxy works
```

---

## 16. Testing Map

```text
UI change      → build → affected page (mobile/desktop)
Auth change    → login 3 roles • protected route 401 • logout
DB/RLS change  → CRUD • unauthorized • anon/student/teacher/admin
News change    → publish → public feed count + ticker
AI change      → chat (200) • 11th msg/min (429) • >4000 chars (400)
Scheduler      → manual trigger → run logged
Notification   → trigger → student bell + /notifications page
Deploy         → frontend 200 • /health 200 • CORS preflight 204 • headers
```

---

## 17. Learning Roadmap

Build foundational → advanced. Each item: what / where / next.

1. **REST + Express** — HTTP server with routed JSON. *Where*: `server/index.js` + `routes/*.js`. *Next*: read `index.js` + one route + `middleware/auth.js`.
2. **JWT + Authentication** — Bearer tokens, validated server-side. *Where*: `middleware/auth.js`. *Next*: trace `req.user` from `supabase.auth.getUser`.
3. **Client vs service-role** — anon key (RLS-gated) vs service-role (bypasses RLS). *Where*: `src/lib/supabase.js` vs `server/lib/db.js`. **#1 security boundary.**
4. **React hooks + auth state** — `useEffect` + subscription. *Where*: `src/hooks/useAuth.jsx`. *Next*: → `ProtectedRoute` → role gating.
5. **Postgres + RLS** — Row filters per user. *Where*: `supabase/schema.sql` policies. *Next*: read one policy + its `USING` clause.
6. **AI classification** — Intent→tool dispatch (assistant) / categorization (news). *Where*: `server/lib/ai.js`. *Next*: OpenAI → keyword fallback.
7. **Crawler loop** — Interval-based crawling → review queue. *Where*: `scheduler.js`, `agentEngine.js`. *Next*: `runAgentCycle()` → `checkSource()`.
8. **Phase 7 hardening** — H-1, M-1, M-2 fixes. *Where*: migration + `notifications.js`/`records.js`/`assistant.js`.

---

## 18. Glossary

- **JWT** — Bearer token (`access_token`) proving identity.
- **Session** — `{access_token, refresh_token}` from Supabase.
- **Anon key** — `VITE_SUPABASE_ANON_KEY` — public, client-side; relies on RLS.
- **Service-role key** — `SUPABASE_SERVICE_ROLE_KEY` — secret, server-only; bypasses RLS. **Never frontend.**
- **RLS** — Row Level Security; Postgres row filter using `auth.uid()`.
- **Protected route** — `ProtectedRoute.jsx` — redirects unauth → `/login`; null profile → `/unauthorized` (fail-closed).
- **Demo login** — `/api/auth/demo-login` — ID+role; fail-closed in prod.
- **News item** — `news_items` row; `pending`→`verified`→`published`.
- **News source** — `news_sources` row (`is_active`, `check_frequency_hours`).
- **Agent run** — `ai_agent_runs` row (`source_check` or `chat_response`); admin-only.
- **Scheduler** — `server/lib/scheduler.js` — interval loop with boot catch-up.
- **Tool** — Role-scoped function the assistant may invoke (e.g. `get_student_attendance`).
- **Intent** — Classification of a chat message → routes to a tool.
- **Trigger** — Server-side hook creating a notification.
- **M-1** — Phase 7 scoping: triggers require `subjectId`+`sectionId` + enrollment.
- **M-2** — Phase 7 limits: 10 req/min/user + 4000-char message cap.
- **CORS** — Backend allow-list (`server/index.js`).
- **HSTS** — Forces HTTPS (`vercel.json`).
- **SPA fallback** — `/api/*` → proxy; `/.*` → `/index.html`.
- **Lazy loading** — `React.lazy()` + `Suspense` in `App.jsx`.

---

## 19. Future Change / Agent Rules

1. Read `BRAIN.md` before significant work.
2. Identify affected subsystem → consult Change Impact Map (§15).
3. Inspect actual implementation — implementation wins over docs.
4. Make the smallest appropriate change.
5. Run relevant tests (§16).
6. Update `BRAIN.md` when architecture/workflows/major features change.

> **BRAIN.md is a map, not truth.** If it conflicts with implementation, implementation
> wins — and this file should be updated.

---

## 20. Documentation Maintenance

Update `BRAIN.md` when these materially change: architecture · major feature · API ·
DB · auth/authz · deployment · security model · workflow · dependency · roadmap.

Do **not** update for: typo fixes · minor CSS · isolated bug fixes · routine patches.
Keep it concise, accurate, and useful. The implementation remains the source of truth.

---

### Documentation Consolidation

**Kept (separate purpose):**
- `IMPLEMENTATION_AUDIT.md` — Phase 1 audit source-of-truth for structure.
- `DESIGN_SYSTEM.md` — UI/UX guidelines (preserve, improve incrementally).
- `PHASE2_SETUP_GUIDE.md` — historical setup guide (partly stale: `useAuth.js`→`.jsx`).
- `HANDOFF.md` — historical pre-completion notes (stale "What's Left" merged here).
- `README.md` — standard repo file.

**Merged into BRAIN.md:** Architecture, tech stack, feature map, user flows, data flow,
auth model, database map, API map, security model, deployment, env variables, operational
workflows, change impact, testing, learning roadmap, glossary, agent rules.

**Deleted:** None.