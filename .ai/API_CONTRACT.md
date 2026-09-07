# API Contract

## Base Rules

1. **All API paths are mounted under `/api` in `server/index.js`.**
2. **Public endpoints** require no token.
3. **Protected endpoints** require `Authorization: Bearer <access_token>`.
4. **Admin endpoints** additionally require `requireRole('admin', 'super_admin')`.
5. **Error envelope is always `{ error: string, code: string }`.**
   - 4xx: controlled message + stable code.
   - 5xx: generic message to client; full detail logged server-side only.
6. **Success responses** are JSON bodies or `204 No Content` with no body.
7. **Pagination** uses `?page=` and `?limit=`; defaults and max caps are defined per route.
8. **Input validation** happens at the boundary of every mutation endpoint using `server/lib/validate.js`.
9. **Rate limiting** is in-memory per IP (auth) or per user ID (chat). Document limits in the endpoint spec.

## Request/Response Conventions

- `POST`, `PUT`, `PATCH` bodies are JSON.
- `GET` query params are used for filters and pagination.
- UUIDs are validated with `isUuid(value)` before use.
- Dates are `YYYY-MM-DD` unless a timestamp is required.
- Arrays are bounded (`requireArray` with `max`).
- Strings are trimmed and bounded (`requireString` with `min`/`max`).
- Emails are lowercased and validated (`requireEmail`).

## Frontend API Client (`src/lib/api.js`)

- `api.get(path)`, `api.post(path, body)`, `api.put(path, body)`, `api.patch(path, body)`, `api.delete(path)`
- Paths may be `/assistant/chat` or `/api/assistant/chat`; both are normalized.
- Bearer token is attached from `supabase.auth.getSession()`.
- Non-2xx responses throw with `err.message` = server `error`, `err.status` = HTTP status, `err.code` = server `code`.

## New Endpoint Requirements

1. **Mount in `server/index.js`** — Agent 1 coordinates exact line/order.
2. **Use existing middleware** — `authRequired`, `requireRole`, `getStudentForAuth`, `getTeacherForAuth`.
3. **Use `sendError(res, err)`** for all errors.
4. **Return consistent shapes** — arrays for lists, `{ data, meta }` for paginated lists, single object for resources.
5. **Audit log non-blocking** — auth and provisioning events log to `audit_logs`; logging failure must never block the response.

## Endpoint Ownership

| Domain | Router File | Existing Owner |
|--------|-------------|----------------|
| News | `server/routes/news.js` | Agent 3 |
| Auth | `server/routes/auth.js` | Agent 3 |
| Academics | `server/routes/academics.js` | Agent 3 |
| Profile | `server/routes/profile.js` | Agent 3 |
| Records (attendance/marks) | `server/routes/records.js` | Agent 3 |
| Students | `server/routes/students.js` | Agent 3 |
| Teachers | `server/routes/teachers.js` | Agent 3 |
| Agent | `server/routes/agent.js` | Agent 3 |
| Notifications | `server/routes/notifications.js` | Agent 3 |
| Assistant | `server/routes/assistant.js` | Agent 3 |
| Users | `server/routes/users.js` | Agent 3 |
| New domain | `server/routes/<new>.js` | Agent 3 |

## Frontend Route Ownership

| Route | Page File | Owner |
|-------|-----------|-------|
| `/` | `src/pages/Home.jsx` | Agent 2 |
| `/login` | `src/pages/Login.jsx` | Agent 2 |
| `/activate` | `src/pages/ActivateAccount.jsx` | Agent 2 |
| `/student-dashboard` | `src/pages/StudentDashboard.jsx` | Agent 2 |
| `/teacher-dashboard` | `src/pages/TeacherDashboard.jsx` | Agent 2 |
| `/admin-dashboard` | `src/pages/AdminDashboard.jsx` | Agent 2 |
| `/admin/news` | `src/pages/AdminNews.jsx` | Agent 2 |
| `/admin/agent` | `src/pages/AdminAgent.jsx` | Agent 2 |
| `/admin/users` | `src/pages/AdminUsers.jsx` | Agent 2 |
| `/news` | `src/pages/NewsPage.jsx` | Agent 2 |
| `/notifications` | `src/pages/Notifications.jsx` | Agent 2 |
| `/profile` | `src/pages/PortalProfile.jsx` | Agent 2 |
| New route | `src/pages/<NewPage>.jsx` + `src/App.jsx` edit | Agent 2 (Agent 1 coordinates `App.jsx`) |
