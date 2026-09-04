# BRAIN.md — MBSCET College Digital Platform

> **Living system map.** Read this first, then trust the implementation over this file.
> Production baseline: commit `4269d62` (HEAD == origin/main, working tree clean).

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
**PROJECT COMPLETE — PRODUCTION VERIFIED** (commit `4269d62`).
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
| UI polish | Enhancement | per `DESIGN_SYSTEM.md` |

> Phase 8 does not exist in the original plan.

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

Browser DB reads (where RLS permits) ← src/lib/supabase.js (anon key)
```

**Production path:** Browser → `/api/...` on Vercel → Vercel rewrites to Render → Express uses
Supabase **service-role key** (bypasses RLS).

**Two Supabase clients:**
1. **Browser** (`src/lib/supabase.js`) — anon key — direct reads only where RLS permits.
2. **Server** (`server/lib/db.js`) — service-role key — bypasses RLS; server-side only,
   **never imported by frontend**.

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
│   ├── pages/                # Home, Login, Signup, Student/Teacher/Admin Dashboard,
│   │                          AdminNews, AdminAgent, AdminUsers, News, Notifications
│   ├── hooks/                # useAuth.jsx (NOTE: .jsx not .js), useScrollAnimation
│   ├── lib/                  # api.js, auth.js, supabase.js, notificationFormat
│   └── assets/
├── server/
│   ├── index.js              # Entry — routers, CORS, errors, scheduler
│   ├── package.json
│   ├── middleware/auth.js    # authRequired, requireRole, role scoping
│   ├── lib/                  # db.js (svc-role), ai.js, agentEngine.js,
│   │                          │  scheduler.js, httpError.js, validate.js
│   └── routes/               # academics, auth, profile, records, students,
│                              # teachers, news, agent, notifications,
│                              # assistant, users
├── supabase/
│   ├── schema.sql            # Full schema + RLS + seed data
│   └── migrations/           # H-1 RLS fix
├── scripts/
│   └── seed-demo.mjs         # Idempotent seed (identities, timetable, news sources)
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

**Authentication** — Prod: email/password via Supabase GoTrue; demo portal-ID login dev-only (fail-closed). Frontend: `src/lib/auth.js`, `src/hooks/useAuth.jsx`, `ProtectedRoute.jsx`. Backend: `server/routes/auth.js`. Middleware: `server/middleware/auth.js`. DB: `profiles` (role). Verified ✅ all 3 roles login.

**Student Portal** — `StudentDashboard.jsx`; `students.js`, `records.js`; DB: `students`, `enrollments`, `attendance`, `marks`, `timetable`, `subjects`. Verified ✅ dashboard + tabs.

**Teacher Portal** — `TeacherDashboard.jsx`; `teachers.js`, `records.js`; DB: `teachers`, `teacher_subjects`, `attendance_sessions`, `marks`. Verified ✅ dashboard + marks-trigger.

**Admin Portal** — `AdminDashboard.jsx`, `AdminNews.jsx`, `AdminAgent.jsx`, `AdminUsers.jsx`; `users.js`, `news.js`, `agent.js`. Verified ✅ news publish + agent monitoring.

**News** — `NewsPage.jsx` (public), `AdminNews.jsx` (admin); `news.js`; DB: `news_items`, `news_sources`. Feed `GET /api/news` anon-allowed. 5 live items. Verified ✅.

**AI News Agent** — `AdminAgent.jsx`; `agent.js`, `agentEngine.js`, `scheduler.js`; DB: `ai_agent_runs`, `ai_agent_events`. 60-min + boot catch-up. Verified ✅ scheduler firing.

**AI Assistant** — `AIAssistant.jsx`; `assistant.js`; role-scoped tools. 10 req/min + 4000-char cap. Verified ✅ authenticated chat live.

**Notifications** — `NotificationBell.jsx`, `Notifications.jsx`; `notifications.js`; DB: `notifications`, `notification_preferences`. Triggers with M-1 scoping. Email NOT WIRED. Verified ✅ marks-notification visible live.

---

## 7. User Flows

### Authentication (production)
```text
User → /login → email/password form → signInWithEmail() → Supabase GoTrue issues JWT
 → useAuth.jsx sets session + profile → ProtectedRoute → correct dashboard
 → Navbar/PortalLayout use session+role → logout clears session
```

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

### Database changes
- Edit `supabase/schema.sql`, apply to Supabase (dashboard or migration), commit migration file.

### AI News Agent
- Runs automatically (60-min + boot catch-up).
- Manual trigger: `POST /api/agent/run` (admin only).
- Monitor: Admin → AI Agent page.

---

**Commit:** `4269d62` (HEAD == origin/main) · Working tree: clean · Pushed ✅

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
| Git | ✅ `4269d62` pushed, `HEAD == origin/main` |

**Known limitations (non-blocking):**
- Email notifications: NOT WIRED (optional future feature)
- AI uses keyword heuristics when no `OPENAI_API_KEY` (optional)
- 20 pending news items await manual review (content, not a bug)

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