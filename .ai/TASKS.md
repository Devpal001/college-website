# Tasks

## Workflow for Every Feature

```
Agent 1 defines contract
→ Agent 4 implements schema/migration
→ Agent 3 implements API
→ Agent 2 implements UI/integration
→ Agent 5 verifies
→ Agent 1 resolves shared-file changes
→ merge
```

## Feature Lifecycle

1. **Proposal** — Agent 1 creates a feature entry in this file with scope, affected modules, and risk level.
2. **Contract** — Agent 1 updates `API_CONTRACT.md` and `DATABASE_CONTRACT.md` with the new endpoints and schema.
3. **Database** — Agent 4 writes migration, updates `schema.sql`, applies to Supabase, updates seed data.
4. **Backend** — Agent 3 creates route file, implements handlers, validation, error envelope, mounts in `server/index.js`.
5. **Frontend** — Agent 2 creates page/component, adds API methods, integrates into `src/App.jsx` (via Agent 1).
6. **QA** — Agent 5 reviews contracts, runs smoke tests, verifies auth/RLS/CORS, checks error sanitization.
7. **Integration** — Agent 1 coordinates merge of shared-file changes (`App.jsx`, `server/index.js`, `schema.sql`, `api.js`, `index.css`, `auth.js`).
8. **Merge** — Feature branch merged to `main` only after Agent 1 sign-off.

## Parallel vs Sequential

### PARALLEL (no coordination needed)
- Frontend UI improvements on existing pages (Agent 2)
- New backend route files in `server/routes/` (Agent 3)
- New migration design and drafting (Agent 4)
- Test script development (Agent 5)
- AI tuning in `server/lib/ai.js` (Agent 3)

### PARALLEL with Contract (Agent 1 mediates)
- New feature with new endpoints:
  - Agent 1 publishes contract
  - Agent 2, Agent 3, and Agent 4 work in parallel against the contract
  - Agent 5 reviews each piece as it lands

### SEQUENTIAL (must wait)
1. Database migration applied → Agent 3 can write routes against new schema
2. Agent 3 deploys routes → Agent 2 can integrate frontend
3. Any change to `server/middleware/auth.js` → all agents re-verify role behavior
4. Any change to RLS policies → Agent 5 re-verifies data isolation

## Shared-File Protocol

### High-Conflict Files
| File | Rule |
|------|------|
| `src/App.jsx` | Agent 1 only. Agents 2 and 3 request route additions through Agent 1. |
| `server/index.js` | Agent 1 only. Agents 3 requests router mounts through Agent 1. |
| `supabase/schema.sql` | Agent 4 drafts; Agent 1 reviews and merges. Other agents never edit. |
| `src/index.css` | Agent 1 only. Token changes are coordinated. Agent 2 reports UI issues; Agent 1 adjusts tokens. |
| `src/lib/api.js` | Agent 2 adds methods following existing patterns. Agent 1 reviews for consistency. |
| `server/middleware/auth.js` | Agent 1 only. Any auth logic change affects every agent. |

### Merge Procedure for Shared Files
1. Agent 1 creates an integration branch from `main`.
2. Agent 1 applies shared-file edits in a single commit with message `feat(integration): <feature> shared wiring`.
3. Feature branches are rebased onto the integration branch.
4. Conflicts are resolved by Agent 1, consulting the owning agent if needed.
5. Integration branch is merged to `main`.

## Integration/merge Procedure

1. **Feature branches** — Each feature gets a branch named `feature/<slug>`.
2. **Daily sync** — Agent 1 merges all feature branches into `dev` daily.
3. **Shared-file lock** — When Agent 1 edits shared files, other agents pause related work.
4. **Pre-merge checklist** (Agent 5):
   - `npm run build` passes
   - `node server/index.js` boots; `/health` returns 200
   - Auth smoke tests pass for all roles
   - RLS spot-checks pass
   - CORS spot-check passes
   - No new lint errors introduced
5. **Merge to `main`** — Only after Agent 1 and Agent 5 sign off.

## QA Acceptance Criteria

### Smoke Tests (required for every merge)
- [ ] `npm run build` passes
- [ ] `node server/index.js` boots without error
- [ ] `GET /health` returns 200
- [ ] `GET /api/news` returns 200 (public)
- [ ] `GET /api/agent/status` returns 401 without token
- [ ] Login as student, teacher, admin → respective dashboards load
- [ ] Protected route without token redirects to `/login`
- [ ] Protected route with wrong role returns 403/`/unauthorized`
- [ ] Non-active account is blocked at login

### Feature-Specific Criteria
- [ ] API contract matches implementation exactly
- [ ] Frontend handles all API error shapes (`error`, `code`, `status`)
- [ ] Empty states render when backend returns empty arrays
- [ ] Loading states render during API calls
- [ ] Role-gated UI elements are hidden for unauthorized roles
- [ ] New database tables have RLS policies for all roles
- [ ] New endpoints have input validation for all boundary fields
- [ ] Audit logs are written for sensitive actions
- [ ] Error messages do not expose raw database or internal details

### Security Criteria
- [ ] No service-role key exposure in frontend
- [ ] No new unauthenticated data endpoints
- [ ] Rate limits documented and enforced
- [ ] CORS origins are allow-listed
- [ ] Security headers present on Vercel responses

## Current Feature Backlog

| Feature | Status | Agent 3 | Agent 2 | Agent 4 | Agent 5 |
|---------|--------|---------|---------|---------|---------|
| Mobile/responsive optimization | Pending | — | Owner | — | Verify |
| Accessibility audit | Pending | — | Owner | — | Verify |
| Legacy cleanup | Pending | Owner | — | — | Verify |
| Admin announcements CRUD | Pending | Owner | Owner | Owner | Verify |
| Events management | Pending | Owner | Owner | Owner | Verify |
| Documents management | Pending | Owner | Owner | Owner | Verify |
| Admissions review workflow | Pending | Owner | Owner | Owner | Verify |
| AI assistant improvements | Pending | Owner | Owner | — | Verify |
| News agent enhancements | Pending | Owner | — | — | Verify |
| Email delivery wiring | Pending | Owner | — | — | Verify |
