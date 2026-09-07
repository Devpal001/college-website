# Multi-Agent Development Contract

This directory contains the canonical planning documents for parallel multi-agent development.
These files are the single source of truth for architecture, API contracts, database contracts,
ownership boundaries, and integration procedures.

## Documents

| File | Purpose | Owner | Editable By |
|------|---------|-------|-------------|
| `PROJECT.md` | Project overview, module boundaries, agent responsibilities | Agent 1 | Agent 1 only |
| `ARCHITECTURE.md` | Canonical architecture decisions, deployment, security model | Agent 1 | Agent 1 only |
| `API_CONTRACT.md` | API design rules, conventions, error envelope, endpoint ownership | Agent 1 | Agent 1 only |
| `DATABASE_CONTRACT.md` | Database ownership, migration rules, RLS contract, seed data | Agent 1 | Agent 1 only |
| `TASKS.md` | Development workflow, parallel/sequential rules, integration procedure, QA criteria | Agent 1 | Agent 1 only |

## Rule of Precedence

1. If `PROJECT.md`, `ARCHITECTURE.md`, `API_CONTRACT.md`, `DATABASE_CONTRACT.md`, or `TASKS.md`
   conflict with any other document or with implementation, **the `.ai/` document wins**.
2. If implementation conflicts with these contracts, the implementation must be adjusted.
3. No agent may modify these files except Agent 1.

## Workflow

For every future feature:

```
Agent 1 defines contract
→ Agent 4 implements schema/migration
→ Agent 3 implements API
→ Agent 2 implements UI/integration
→ Agent 5 verifies
→ Agent 1 resolves shared-file changes
→ merge
```

## Quick Reference: Agent Ownership

| Agent | Primary Owns | Must Not Touch |
|-------|--------------|----------------|
| Agent 1 — Planner | `.ai/*.md`, shared-file coordination | `src/`, `server/`, `supabase/` |
| Agent 2 — Frontend | `src/pages/`, `src/components/`, `src/hooks/`, `src/lib/api.js` additions | `src/App.jsx`, `src/index.css`, `server/`, `supabase/` |
| Agent 3 — Backend | `server/routes/*.js` (new), `server/lib/*.js` (new) | `server/index.js`, `server/middleware/auth.js`, `src/`, `supabase/` |
| Agent 4 — Database | `supabase/migrations/*.sql`, `supabase/schema.sql`, `scripts/seed-demo.mjs` | `src/`, `server/` |
| Agent 5 — QA | Test scripts, security audits, CI workflows | Application source code |
