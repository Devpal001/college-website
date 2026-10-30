# Database Backup, Migration & Portability

How to export, back up, transfer, import and verify the MBSCET platform data —
and what has to change if the college later hosts the database itself.

Current shape (nothing here is hardcoded; everything comes from `.env`):

```
React app  →  Express API (server/)  →  Supabase PostgreSQL
              service-role key          schema: supabase/schema.sql
              server/lib/db.js          migrations: supabase/migrations/
```

---

## 1. Two backup formats — pick per situation

| Situation | Method | Fidelity |
| --- | --- | --- |
| Full, exact clone (schema + data + policies + sequences) | `pg_dump` | Byte-exact; the reference method |
| Provider-independent snapshot / quick verification | `scripts/export-data.mjs` (JSON per table) | Data only (no schema/RLS) |

Both are READ-ONLY with respect to the database.

### 1.1 Logical snapshot (JSON) — works with no extra tooling

```bash
npm run backup                      # → data/backup-YYYYMMDDHHmmss/
node scripts/export-data.mjs --out data/snapshot-before-import
```

* Writes one `<table>.json` per table plus `manifest.json` (row counts, source,
  timestamp). 29 tables are covered — the list lives in `scripts/tables.mjs`.
* `data/` is git-ignored: snapshots contain real user data.
* Missing tables are reported and skipped, so the same script works against a
  partially provisioned database.

### 1.2 Exact dump (schema + data)

```bash
# DATABASE_URL = Supabase dashboard → Project Settings → Database → Connection string
pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges -Fc -f backup.dump
pg_dump "$DATABASE_URL" --schema=public --schema-only -f schema.sql     # structure only
pg_dump "$DATABASE_URL" --data-only --column-inserts -t admissions -t messages -f forms.sql
```

`-Fc` (custom format) is the portable choice: `pg_restore` can then restore into
any PostgreSQL 14+ database, including a college-hosted one.

---

## 2. Import

### 2.1 Restore into a fresh college / Supabase database

```bash
# 1. Create the database (college Postgres, or a new Supabase project).
# 2. Apply the schema in version order:
psql "$COLLEGE_DATABASE_URL" -f supabase/schema.sql
# ... then every file in supabase/migrations/ (oldest first)
psql "$COLLEGE_DATABASE_URL" -f supabase/migrations/2026_09_16_public_form_tables.sql

# 3a. Exact restore from a custom-format dump:
pg_restore --no-owner --no-privileges --data-only -d "$COLLEGE_DATABASE_URL" backup.dump

# 3b. Or restore from a JSON snapshot (idempotent, upsert-only):
node scripts/restore-data.mjs --dir data/backup-YYYYMMDDHHmmss            # dry run
node scripts/restore-data.mjs --dir data/backup-YYYYMMDDHHmmss --confirm  # writes
```

`restore-data.mjs` safety model:

* **Dry run by default** — nothing is written without `--confirm`.
* **Upsert only, never delete** — a wrong snapshot cannot destroy live data.
* Parents are written before children (`scripts/tables.mjs` order).
* Tables whose rows have no single-column `id` are reported and skipped
  (use `pg_restore` for those).
* Row counts are checked after each table.

### 2.2 Auth users (Supabase-specific)

`auth.users` is managed by Supabase GoTrue and is **not** part of a plain
`schema=public` dump. Accounts must be transferred separately:

* Recreate them with the service-role admin API
  (`supabase.auth.admin.createUser` — `scripts/seed-demo.mjs` shows a working
  pattern), then restore `public.profiles` / `students` / `teachers`.
* Keeping `profiles.id` identical to the auth user id is what links the two
---

## 3. Verification (always do this)

```bash
node scripts/verify-data.mjs --dir data/backup-YYYYMMDDHHmmss
```

Compares row counts per table (snapshot vs the database the app currently
points at) and spot-checks that the snapshot's ids exist. Exit code 1 means a
table needs attention.

Worth running after a migration:

```bash
node scripts/probe-db.mjs          # which tables exist + row counts
node scripts/status.mjs            # API/web health
node scripts/test-public-forms.mjs # public write paths work against the new DB
node scripts/test-demo-login.mjs   # end-to-end auth (needs the API running)
```

---

## 4. Moving to college-hosted infrastructure

No application rewrite is required; the boundary is already in place.

| Scenario | What changes | What does NOT change |
| --- | --- | --- |
| A. College PostgreSQL | `server/lib/db.js`, apply `schema.sql` + migrations to the college DB | routes, middleware, validation, frontend |
| B. College API → college DB | the `supabase.from(...)` calls inside `server/routes/*.js` | public API contract, frontend, auth middleware |
| C. College SSO | `server/routes/auth.js` (session issuance) + `src/lib/auth.js` (handshake) | `GET /api/auth/me`, `ProtectedRoute`, dashboards, `requireRole` |

Rules that keep this true:

1. The browser only talks to `/api` (plus Supabase GoTrue for the login
   session). Application data never comes straight from a database table.
2. Roles are resolved server-side (`server/middleware/auth.js`) — the frontend
   never decides what a user may do.
3. Infrastructure values live in `.env` (`SUPABASE_URL`, keys, `PORT`,
   `CORS_ORIGINS`, optional `DATABASE_URL`); no host or project id is hardcoded.
4. The service-role/secret key is server-only. The browser receives only the
   anon key (safe to publish). Private institutional credentials stay
   server-side.

---

## 5. Recurring backup recommendation

* Before every schema migration or bulk import: `npm run backup`.
* Weekly (or nightly): `pg_dump … -Fc` to college-controlled storage.
* Keep the dump **and** one JSON snapshot: the dump restores exactly, the
  snapshot is verifiable and readable without PostgreSQL tooling.
* Store snapshots outside the git repository (`data/` is ignored on purpose).

---

## 6. Free-plan project pausing — policy (verified 2026-10-09)

This project runs on the Supabase **Free plan**. Supabase warns the project
owner by email that Free projects are paused automatically after about a week of
low database activity. Everything below is taken from Supabase's own
documentation and pricing pages on 2026-10-09 — re-check them if this is read
much later:

| Fact | Source |
| --- | --- |
| Free projects are paused after ~1 week of insufficient **user database activity**; reads/writes through the API count because they hit the database | Docs → Platform → Project Pausing |
| "Typically a few user requests to the database each day over the previous week is enough to keep the project from being paused" — explicitly not a guarantee | same |
| A warning email is sent ~1 week before the pause; a second email once the project is paused | same |
| After a warning email, opening the project in the Dashboard, or real traffic from the connected application, generates qualifying activity | same |
| A paused project can be resumed from the Dashboard with data and configuration intact; current docs state a restore window of **up to 1 year**, while the warning email may state **90 days** — plan for the shorter figure | Docs → Project Pausing vs. the owner's email |
| The only documented way to be exempt from inactivity pausing is a paid plan: "Paid projects cannot be paused and are not subject to pausing for inactivity" (Pro from **$25/month** — verify current pricing on supabase.com/pricing) | Docs → Preventing automatic project pausing; Pricing |
| The Free plan gets **no automatic backups**. Daily backups start at Pro (7-day retention). Supabase recommends that Free projects "regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups" | Docs → Platform → Database Backups |
| Database backups on any plan exclude Storage objects and custom-role passwords | same |

What this means for this platform:

* Everything depends on this one project: the browser signs in through its
  GoTrue endpoint and the Express API reads/writes all 29 tables through it
  (architecture diagram at the top of this file). A pause takes login and every
  dashboard down until the project is resumed.
* There is **no supported Free-plan setting** that disables automatic pausing.
  Do not rely on synthetic or scheduled pings to game the activity detector —
  real application use is the intended signal.
* After the restore window expires, Supabase's retained backups are deleted and
  the data is unrecoverable. An **off-project copy** (this document's §1
  procedures) is the only insurance that does not cost money.
* This application does **not** use Supabase Storage (campus/gallery images are
  bundled in `src/assets/`), so the Storage exclusion above loses nothing here.

---

## 7. Free-plan runbook — backup cadence & pausing preparedness

### 7.1 Maintenance cadence (no paid plan required)

| When | What | How |
| --- | --- | --- |
| Weekly | JSON snapshot of all 29 tables | `npm run backup` (or the opt-in workflow in §7.2) |
| Weekly / monthly | Byte-exact dump (needs `DATABASE_URL`) | `pg_dump … -Fc` — §1.2 |
| Before every schema change or bulk import | Snapshot + schema dump | §1.1 + §1.2 |
| Monthly | Restore drill | `node scripts/restore-data.mjs --dir <snapshot>` (dry-run by default) |
| When the pausing warning email arrives | Follow §7.3 | — |

Copies must live **off this machine** (college-controlled storage, external
drive, encrypted archive). `data/` is git-ignored on purpose: a snapshot sitting
next to the database credentials on the same disk is not a disaster-recovery
plan.

### 7.2 Automated weekly export (opt-in, GitHub Actions)

`.github/workflows/backup.yml` runs weekly (Monday 03:00 UTC) and on manual
dispatch:

* Reads repository secrets `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  (the same pair CI already uses) and optionally `DATABASE_URL` (adds a
  `pg_dump -Fc` file alongside the JSON export).
* If the Supabase secrets are absent it **skips cleanly** — the workflow never
  fails just because backups are not configured.
* Artifacts are uploaded **only** when an extra repository secret
  `BACKUP_ARTIFACTS_ENABLED=true` is set. This repository is public: treat
  every artifact as sensitive user data, keep the retention short, and do not
  rely on artifacts as the off-site copy of record (§7.1).
* The `pg_dump` step is best-effort: a hosted runner's `pg_dump` major version
  must be ≥ the project's Postgres version; if it cannot run, the version-
  independent JSON snapshot is still produced.
* Secrets come only from GitHub's secret store — never printed, never committed.

### 7.3 When the pausing warning email arrives

1. Take a snapshot immediately: `npm run backup`, and `pg_dump … -Fc` when
   `DATABASE_URL` is available (§1.2). Copy the files off this machine.
2. Open the project in the Supabase Dashboard — the docs list a dashboard visit
   as qualifying activity after a warning.
3. Verify the snapshot: `node scripts/verify-data.mjs --dir data/backup-…`.
4. If students/teachers are actively using the deployed site, normal
   application traffic is the intended activity signal — check API/web health
   (`node scripts/status.mjs`) instead of generating test requests.
5. If pausing must be impossible (e.g. during admissions or exams), the only
   documented option is upgrading to Pro — an owner decision that costs money.

### 7.4 If the project is paused anyway

1. Dashboard → organization → project → **Resume project**. Data and
   configuration return as they were; do this well inside the restore window
   (§6 — treat the shorter figure from the email as the deadline).
2. After resuming: `node scripts/status.mjs`, then
   `node scripts/verify-data.mjs --dir <latest snapshot>`, then spot-check
   logins for all three roles.
3. Anything missing versus the snapshot: restore paths in §2 (`pg_restore`, or
   `restore-data.mjs --dir … --confirm`).
4. Auth users live outside the `public` schema — §2.2 applies: recreate via the
   service-role admin API, or dump the `auth` schema with `pg_dump` when
   `DATABASE_URL` is available.

### 7.5 What a JSON snapshot does NOT contain

| Item | Where it lives | How to preserve |
| --- | --- | --- |
| `auth.users` (passwords, identities, sessions) | Supabase GoTrue | `pg_dump` of the `auth` schema (`DATABASE_URL`), or recreate via the admin API — §2.2 |
| Schema, RLS policies, functions, triggers, sequences | database DDL | already in git: `supabase/schema.sql` + `supabase/migrations/`; byte-exact: `pg_dump --schema-only` |
| Storage buckets / objects | Supabase Storage | not used by this app — images are bundled in `src/assets/` |
| Project settings (JWT secret, rate limits, providers) | Supabase Dashboard | note them manually in the college's password manager; nothing in this repo captures them |
| Env values on Vercel / Render | host dashboards | keep `.env.example` in sync; store real values in a password manager, never in git |