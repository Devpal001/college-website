# MBSCET College Digital Platform — Industrial Refactor Audit

Date: 2026-09-16 · Scope: progressive improvement of the existing implementation
(no rebuild). Companion docs: `docs/BACKUP_MIGRATION.md`, `BRAIN.md`, `HANDOFF.md`.

Baseline commit: `a4f9a63` (`main`). Changes described here are **uncommitted** in
this working copy.

---

## 1. Current architecture

```
React 19 + Vite (src/)
  Pages / components
        ↓  hooks + lib (src/lib/api.js — single API client)
Express API (server/index.js → server/routes/*.js)
        ↓  server/middleware/auth.js (authRequired + requireRole)
        ↓  server/lib/*  (db, validate, httpError, rateLimit, academics, ai)
Supabase PostgreSQL (supabase/schema.sql + migrations)
```

* **Frontend**: 20 pages, 14 components, 5 hooks, 4 lib modules, 3 data modules.
* **Backend**: 13 route modules (`auth, users, students, teachers, records,
  timetable, academics, profile, notifications, news, assistant, agent, public`),
  auth middleware, 9 lib modules.
* **Route-level** `React.lazy()` code splitting; dashboards/admin pages load on
  demand.
* Auth: Supabase GoTrue issues the JWT; the Express API validates it on every
  request and resolves the profile (role + account status) server-side.

## 2. Confirmed issues (found and fixed)

| # | Issue | Evidence | Status |
| --- | --- | --- | --- |
| 1 | `Admissions.jsx` wrote to the `admissions` table straight from the browser with the anon key | `supabase.from('admissions').insert([form])` | Fixed: `POST /api/admissions` |
| 2 | `Contact.jsx` wrote to the `messages` table straight from the browser | `supabase.from('messages').insert([...])` | Fixed: `POST /api/contact` |
| 3 | `Navbar.jsx` read `profiles.role` from the browser and kept its own duplicate copy of session + role | `supabase.auth.getSession()` + `profiles.select('role')` + its own `onAuthStateChange` | Fixed: shared session store + `GET /api/auth/me` |
| 4 | `useAuth` / `Login` queried `profiles` directly per consumer (duplicate fetches, role decided in the browser) | `getUserProfile(userId)` | Fixed: removed; role now comes from the API |
| 5 | Auth rate limiter copy-pasted into three handlers with an unused helper | `isRateLimited()` + 3 inline 429 blocks | Fixed: `server/lib/rateLimit.js` |
| 6 | Attendance/marks arithmetic duplicated across modules and already drifting (integer vs 1-decimal rounding) | `students.js` (3 sites) + `assistant.js` (3 sites) | Fixed: `server/lib/academics.js` |
| 7 | `initials` computation duplicated verbatim in 3 pages | PortalProfile / StudentDashboard / TeacherDashboard | Fixed: `getInitials()` in `src/lib/format.js` |
| 8 | `?tab=` URL-sync block duplicated verbatim in 2 dashboards | StudentDashboard / TeacherDashboard | Fixed: `useTabParam()` hook |
| 9 | `messages` table existed only in the live database — absent from `schema.sql` and every migration | live probe: 4 rows; `schema.sql` has no `messages` | Fixed: `2026_09_16_public_form_tables.sql` |
| 10 | No backup/restore/verify path in the repo | — | Fixed: export/restore/verify scripts + `docs/BACKUP_MIGRATION.md` |
| 11 | Public routers mounted after `/api` routers that call `router.use(authRequired)` returned 401 for anonymous form posts (mount-order trap) | first test run: `POST /api/admissions` → 401 | Fixed + documented in `server/index.js` |

## 3. Existing strengths (preserved deliberately)

* Server-side role resolution (`authRequired` + `requireRole`) and account-status
  enforcement on every protected request.
* Service-role key only in `server/lib/db.js`; the browser receives the anon key
  only. Per-request Supabase clients for session issuance (no cross-request
  session bleed).
* Fail-closed demo-login gate (`DISABLE_DEMO_LOGIN` / `DEMO_LOGIN_ENABLED` /
  `NODE_ENV`), verified by `scripts/test-auth-gate.mjs`.
* CORS allow-list, uniform `{ error, code }` error envelope with no internal
  leakage (`server/lib/httpError.js`), strict request validation
  (`server/lib/validate.js`), parameterized status codes, no raw SQL.
* Modular Express routers, centralized frontend API client (`src/lib/api.js`),
  route-level code splitting, existing E2E/probe scripts.

None of the above was rewritten — only the items in §2 were touched.

## 4. API architecture (unchanged shape, one gap closed)

13 routers mounted in `server/index.js`. Mount-order rule (now documented in the
file): **public routers first** — `newsRouter` and `authRouter` are path-prefixed,
while `academicsRouter` and `recordsRouter` are mounted at `/api` and apply
`router.use(authRequired)`, which runs for *every* request that reaches them.

New/changed endpoints:

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/admissions` | public | validated + rate-limited; replaces direct browser insert |
| POST | `/api/contact` | public | validated + rate-limited; replaces direct browser insert |
| GET | `/api/auth/me` | `authRequired` | identity + authoritative role, backs the session store |

Both public endpoints: whitelist the writable columns (a client cannot set `id`
or `status`), share one rate-limit bucket per IP (10/min), return
`201 { ok: true }` or the standard `{ error, code }` envelope, and write with the
service-role client **server-side only**.

## 5. Code duplication findings

Fixed (IDs refer to §2):

| Duplication | Sites | Now |
| --- | --- | --- |
| Attendance percentage rule (`late` counts as attended) | 4 | `server/lib/academics.js → summarizeAttendance()` |
| Percentage rounding (`Math.round(x*1000)/10`) | 5 | `percentage()` / `roundTo()` |
| Marks average with NaN guards | 2 | `averageMarksPercentage()` |
| Auth rate-limit blocks | 3 | `server/lib/rateLimit.js → createRateLimiter().middleware()` |
| Session + role resolution | 2 | `src/lib/sessionStore.js` (one Supabase subscription app-wide) |
| Avatar initials | 3 | `getInitials()` |
| Dashboard `?tab=` sync | 2 | `useTabParam()` |

Reported, **not** changed (deliberate — see §10): the per-page
`useState(loading/error) + load() + finally setLoading(false)` scaffolding in ~8
pages, and the two near-identical student tables in `TeacherDashboard.jsx`
(attendance vs marks entry). Both are real, but extracting them touches large
working screens and is better done behind the forthcoming QA pass.

Line-count effect: `Navbar.jsx` −45, `useAuth.jsx` −35/+26, `students.js` −35,
`assistant.js` −18; new shared modules `rateLimit.js` (~90),
`academics.js` (~100), `sessionStore.js` (~110), `useTabParam.js` (~35),
`format.js` (~45), `public.js` (~95).

## 6. Database architecture

* Access is exclusively server-side; the browser no longer reads or writes any
  data table (§2 items 1–4) — it only keeps the login session.
* RLS is enabled across the schema; the API bypasses it deliberately with the
  service-role key, and every route re-derives authorization from the JWT.
* **Known drift (documented, not silently changed)**: the live `admissions` table
  uses an integer primary key while `supabase/schema.sql` declares a UUID, and
  `messages` was missing from version control entirely (now fixed by the new
  migration). A fresh provision must reconcile the `admissions` definition
  before it matches production exactly.
* Recommended hardening (operator action; it changes live access rules, so it is
  not automated): drop the legacy `"Public can submit admissions"` anon INSERT
  policy, now that the API is the only writer. SQL + rationale are in
  `supabase/migrations/2026_09_16_public_form_tables.sql`.

## 7. Backup / migration strategy

See `docs/BACKUP_MIGRATION.md`. Summary:

| Step | Command |
| --- | --- |
| Export (portable JSON, read-only) | `npm run backup` → `data/backup-<ts>/` |
| Export (exact, schema + data) | `pg_dump "$DATABASE_URL" --schema=public -Fc -f backup.dump` |
| Restore (dry run / write) | `npm run restore -- --dir <snapshot>` / `… --confirm` |
| Verify | `npm run verify:data -- --dir <snapshot>` |

Verified in this session: export = 2054 rows across 29 tables; verify reported
"Snapshot and database agree"; restore dry-run planned the same 2054 upserts and
wrote nothing. `data/` is git-ignored. Auth users (`auth.users`) are GoTrue-owned
and must be recreated via the admin API — never dumped from `public`.

## 8. Security assessment

Reviewed during the refactor (all preserved; nothing weakened):

* **AuthN/AuthZ**: JWT validated server-side per request; `req.profile` drives
  `requireRole`. The refactor *removed* browser-side role resolution, so the role
  the UI displays now provably comes from the server.
* **Rate limiting**: unchanged bucket semantics (one shared IP bucket, 10/min for
  `demo-login`, `login`, `activate`) — deliberately kept shared so an attacker
  cannot multiply attempts by switching endpoints. Public forms add a separate
  10/min bucket.
* **New public write surface**: validated against a column whitelist, rate
  limited, written server-side; no credentials or table names in the browser.
* **Secret handling**: service-role key still only in `server/lib/db.js`; no new
  `VITE_*` secret; `.env` git-ignored. Backup scripts never print the key, and
  snapshots record only the public project URL.
* **Response hygiene**: `GET /api/auth/me` returns the caller's own profile only
  (no cross-user access); 401 with no token, asserted by test.
* **CORS/errors/validation**: untouched; the new endpoints reuse
  `server/lib/validate.js` and `server/lib/httpError.js`.
* No IDOR/BOLA regression found in the files touched: `/api/profile/:id`,
  `/api/students/:id/*` keep their existing ownership checks.

Targeted checks run: `test-auth-gate.mjs` (demo gate + 401 on protected route),
`test-public-forms.mjs` (401 without token, no key leakage, column whitelist,
rate limit), `test-demo-login.mjs` (role separation, removed legacy routes).

## 9. Changes made (this session)

**New files**

| File | Purpose |
| --- | --- |
| `server/lib/rateLimit.js` | parameterized reusable limiter (shared buckets, bounded memory) |
| `server/lib/academics.js` | attendance/marks rules: `summarizeAttendance`, `percentage`, `roundTo`, `averageMarksPercentage` |
| `server/routes/public.js` | `POST /api/admissions`, `POST /api/contact` |
| `src/lib/sessionStore.js` | one Supabase subscription + one server-side role resolution for the whole app |
| `src/lib/format.js` | `getInitials`, `formatPercent` |
| `src/hooks/useTabParam.js` | deep-linkable tab state for portal dashboards |
| `scripts/tables.mjs` | canonical table list (backup tooling) |
| `scripts/export-data.mjs`, `scripts/restore-data.mjs`, `scripts/verify-data.mjs` | snapshot / guarded restore / verification |
| `scripts/test-public-forms.mjs` | 24 assertions over the new endpoints (self-booting, self-cleaning) |
| `scripts/test-shared-libs.mjs` | 34 assertions over the extracted pure helpers |
| `supabase/migrations/2026_09_16_public_form_tables.sql` | `messages` table + RLS + documented hardening |
| `docs/INDUSTRIAL_AUDIT.md`, `docs/BACKUP_MIGRATION.md` | this document + backup procedure |

**Modified files**: `server/index.js` (mount + order comment),
`server/routes/auth.js` (shared limiter, `GET /api/auth/me`),
`server/routes/students.js` + `server/routes/assistant.js` (shared academics
helpers), `src/hooks/useAuth.jsx` (store-backed), `src/lib/auth.js`
(`getCurrentProfile`, API-based status check, `getUserProfile` removed),
`src/components/Navbar.jsx`, `src/pages/{Admissions,Contact,Login,StudentDashboard,TeacherDashboard,PortalProfile}.jsx`,
`.env.example`, `.gitignore`, `package.json` (helper scripts).

**Not touched**: authentication/session issuance, RLS policies (live), CORS,
error envelope, validation library, database schema (no live DDL executed),
existing dashboards' features and visuals.

## 10. Remaining issues

| Issue | Severity | Note |
| --- | --- | --- |
| `admissions` PK type drift (live `integer` vs `schema.sql` UUID) | Medium | Needs an owner decision before a fresh provision; no data loss risk today |
| Legacy anon INSERT policy on `admissions` still active in the live DB | Low | API is now the only writer; dropping it is a one-line operator action (§6) |
| Pre-existing test failure: `trigger/attendance` with an unknown student returns 400, test expects 404 | Low | Confirmed unrelated to this work (`server/routes/notifications.js` / `scripts/test-demo-login.mjs` unchanged). Either the route should validate the UUID before lookup, or the expectation should match; needs an owner call |
| Page-level `loading/error` scaffolding still duplicated in ~8 pages | Low | Deliberate deferral (§5) |
| `TeacherDashboard.jsx` student tables (attendance vs marks) duplicated | Medium | Largest remaining frontend duplication; defer to the QA pass |
| `supabase/schema.sql` is a single snapshot, not a migration history of live changes | Medium | Migrations now capture new work; the live DB still has earlier undocumented changes |
| Demo ID-only login still present for non-production (by design) | Info | Must be replaced by password/SSO before any public production launch |
| "Make the website global" requirement | Unknown | **Unresolved requirement — requires clarification.** No i18n/CDN/multi-region work was implemented, and none is implied by the codebase |
| Team-leader QA/testing PDF | Pending | Not provided yet; findings will be mapped against this architecture when it arrives |

## 11. Verification & future recommendations

**Executed in this session**

| Suite | Result |
| --- | --- |
| `npx eslint src server` | clean (exit 0) |
| `npm run build` | succeeds (pre-existing large-chunk warning only) |
| `node scripts/test-public-forms.mjs` | 24 / 24 |
| `node scripts/test-shared-libs.mjs` | 34 / 34 |
| `node scripts/test-demo-login.mjs` | 44 / 45 (one pre-existing failure, see §10) |
| `node scripts/verify-timetable-smoke.mjs` | 26 / 26 |
| `node scripts/test-auth-gate.mjs` | demo-login gate + 401 behaviour confirmed |
| `npm run backup` / `verify:data` / `restore --dry-run` | 2054 rows / agree / no writes |

**Recommended next steps (in priority order)**

1. Owner decision on the `admissions` key drift, then align `schema.sql` to
   production (or add a migration to normalize the key) and drop the legacy anon
   INSERT policy.
2. Resolve the one pre-existing test failure above.
3. Extract the remaining dashboard duplication (`useApiResource` hook + a
   parameterized student roster table) — a self-contained follow-up.
4. When the QA PDF arrives: map each finding to a file/section here, fix the
   high-severity items, and re-run the suites listed above.
5. Before any wider rollout: replace demo ID-only login with password/SSO
   (scenario C in `docs/BACKUP_MIGRATION.md`), and schedule the backup
   automation (`npm run backup`, optionally with `DATABASE_URL` + `pg_dump`).
6. Keep the new conventions: pure helpers in `server/lib` / `src/lib`, one API
   client in the browser, one rate limiter, one place that decides a role.