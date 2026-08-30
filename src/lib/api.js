import { supabase } from './supabase';

// ============================================
// PHASE 3 API CLIENT
// Talks to the Express API server (server/index.js),
// which runs with the Supabase service-role key.
// The current Supabase JWT is attached so the server
// can resolve + authorize the user (authRequired).
// ============================================

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

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