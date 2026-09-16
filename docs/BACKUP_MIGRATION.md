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