# Architecture

## Canonical Architecture Decisions

1. **Two Supabase clients, never mixed.**
   - Browser: `src/lib/supabase.js` — anon key, RLS-gated reads only.
   - Server: `server/lib/db.js` — service-role key, bypasses RLS, server-only.
   - The server client must never be imported by frontend code.

2. **Express is the authoritative API layer.**
   - Frontend never queries Supabase directly for authenticated/protected data.
   - All mutations go through `/api/*` → Express → service-role client.

3. **Authorization is always server-side.**
   - Frontend role checks are convenience only.
   - `authRequired` + `requireRole` + RLS are the three enforcement layers.

4. **Modular routers take precedence over legacy inline handlers.**
   - `server/index.js` mounts modular routers before any legacy fallback.
   - New routes must go in `server/routes/*.js`, never as inline handlers.

5. **Service-role key isolation.**
   - `.env` is gitignored.
   - Service-role key is loaded only in `server/lib/db.js` and `server/routes/auth.js` (session issuance).
   - Never committed, never exposed to frontend.

6. **Frontend is a Vite SPA with lazy-loaded routes.**
   - Public pages are eager or lightly lazy-loaded.
   - Dashboards and admin pages are `React.lazy()` + `Suspense`.
   - Route changes must be registered in `src/App.jsx`.

7. **Styling is Tailwind CSS v4 with custom tokens.**
   - Design tokens live as CSS custom properties in `src/index.css`.
   - Unlayered rules in `index.css` override utility classes; future token work must use `@layer base`.

8. **Deployment path is fixed.**
   - Vercel hosts the static build and proxies `/api/*` to Render.
   - Render hosts Express with `node server/index.js`.
   - Supabase is the database and auth provider.

## Deployment Architecture

```
Browser
  → Vercel (static build + SPA fallback)
    → /api/* rewrite → Render (Express)
      → Supabase (service-role for server, anon for browser direct reads)
```

- Vercel: `vercel.json` controls rewrites and security headers.
- Render: `render.yaml` controls build, start, health check, env vars.
- Supabase: schema managed via `supabase/schema.sql` + migrations.

## Security Model Summary

| Layer | Mechanism |
|-------|-----------|
| Identity | Supabase GoTrue JWT |
| Transport | HTTPS enforced by Vercel (`Strict-Transport-Security`) |
| CORS | Allow-list in Express (`server/index.js`) |
| AuthZ | `authRequired` + `requireRole` middleware |
| Data isolation | RLS policies in Supabase |
| Abuse prevention | In-memory rate limiting (auth + chat) |
| Error safety | Standardized `{ error, code }` envelope; raw DB errors never reach client |
| Demo safety | Fail-closed demo login in production (`DISABLE_DEMO_LOGIN=true`) |
| Account lifecycle | `profiles.status` enforced at login and on every protected request |

## Known Constraints

- Render free tier cold starts; scheduler includes boot catch-up.
- In-memory rate limiting does not survive horizontal scaling.
- No automated test suite exists; QA relies on smoke tests and live verification.
- Legacy inline handlers still exist in `server/index.js` below modular mounts; do not re-add unauthenticated data endpoints.
