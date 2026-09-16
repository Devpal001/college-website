// ============================================================
// SESSION STORE (single source of truth for auth state)
// ------------------------------------------------------------
// ONE Supabase auth subscription + ONE `/api/auth/me` call is shared
// by every component that needs the session or the role.
//
// Before this store existed, Navbar.jsx kept its own duplicate
// `supabase.auth.getSession()` + `profiles` query, and useAuth.jsx
// queried `profiles` directly per consumer — so the same data was
// resolved several times per page load, and role resolution lived
// in the browser.
//
// Now the browser asks the Express API, which resolves the role
// server-side (server/middleware/auth.js -> req.profile). The role
// the UI uses is therefore always the authoritative one.
//
// Transport: plain module state + `useSyncExternalStore` (React 19,
// no context provider needed — Navbar renders outside any provider).
// ============================================================
import { supabase } from './supabase';
import { api } from './api';

const initialState = { session: null, user: null, profile: null, loading: true };

let state = initialState;
const listeners = new Set();
let started = false;
let resolveTicket = 0;

function setState(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/** Current snapshot. Identity is stable unless the state actually changes. */
export function getSessionState() {
  return state;
}

/** Subscribe to changes (used by useSyncExternalStore). */
export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Resolves the authoritative profile for a session through the API.
 * A stale response can never overwrite a newer one (ticket check).
 */
async function resolveProfile(session) {
  if (!session?.user) {
    resolveTicket += 1;
    setState({ profile: null, loading: false });
    return;
  }

  const ticket = (resolveTicket += 1);
  try {
    const { profile } = await api.get('/auth/me');
    if (ticket !== resolveTicket) return;
    setState({ profile: profile || null, loading: false });
  } catch (error) {
    if (ticket !== resolveTicket) return;
    console.warn('[session] could not resolve profile:', error?.message || error);
    setState({ profile: null, loading: false });
  }
}

/**
 * Starts tracking the Supabase session exactly once per page load.
 * Idempotent: safe to call from every component that uses useAuth().
 */
export function startSessionTracking() {
  if (started) return;
  started = true;

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      setState({ session, user: session?.user || null });
      return resolveProfile(session);
    })
    .catch((error) => {
      console.warn('[session] could not read the stored session:', error?.message || error);
      setState({ profile: null, loading: false });
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    // Loading stays true while the new session's role is fetched, so
    // ProtectedRoute keeps showing the spinner instead of bouncing a
    // freshly signed-in user to /unauthorized.
    setState({
      session,
      user: session?.user || null,
      loading: Boolean(session?.user),
      profile: session?.user ? state.profile : null,
    });
    void resolveProfile(session);
  });
}

/**
 * Re-resolves the profile for the current session (e.g. after a profile
 * update). Components do not need this — the store refreshes itself on
 * every auth event.
 */
export function refreshSessionProfile() {
  resolveTicket += 1;
  return resolveProfile(state.session);
}
