import { supabase } from './supabase';

// ============================================
// PHASE 3 API CLIENT
// Talks to the Express API server (server/index.js),
// which runs with the Supabase service-role key.
// The current Supabase JWT is attached so the server
// can resolve + authorize the user (authRequired).
// ============================================

// Resolve the API base URL for the environment we are running in:
//
// 1. VITE_API_URL (if set in .env) always wins — explicit override.
// 2. Dev (`npm run dev`): use SAME-ORIGIN relative URLs ('').
//    The Vite dev server proxies /api -> http://localhost:3001 (see
//    vite.config.js). This works no matter which device loads the page:
//    on the PC it's http://localhost:5173/api/..., on a phone on the same
//    Wi-Fi it's http://<PC-LAN-IP>:5173/api/... — both reach the backend
//    through the proxy running on the PC, with no hardcoded IP here.
//    (Do NOT default to http://localhost:3001 in dev: on a phone,
//    "localhost" would be the phone itself, not the PC running the API.)
// 3. Production build: same-origin ('') by default. In a production bundle
//    "localhost" is the VISITOR'S device, not the API server — a hardcoded
//    http://localhost:3001 fallback silently breaks sign-in (and every other
//    API call) on phones / other networks. If the API is deployed on a
//    separate host (e.g. Vercel frontend + Render backend), set VITE_API_URL
//    in that host's build-time environment variables and redeploy.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[api] VITE_API_URL is not set — API calls are being made same-origin. ' +
      'If the Express API runs on a separate host, set VITE_API_URL at build time.'
  );
}

// The Express server mounts every router under /api (see server/index.js:
// app.use('/api/assistant', ...), app.use('/api/notifications', ...), etc.),
// but callers use both path styles ('/assistant/chat' and '/api/news').
// Normalize every request onto the /api mount so both conventions work.
function buildUrl(path) {
  // Already an absolute URL — use as-is.
  if (/^https?:\/\//i.test(path)) return path;
  // Already namespaced under /api — keep it.
  if (path === '/api' || path.startsWith('/api/')) return `${API_BASE}${path}`;
  return `${API_BASE}/api${path}`;
}

async function apiFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // not JSON — keep default message
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};

export default api;