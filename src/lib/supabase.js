// ============================================================
// AUTH LOADER  (keeps the Supabase SDK out of the initial bundle)
// ------------------------------------------------------------
// The Supabase SDK is the largest dependency in this app (~203 KB raw /
// ~53 KB gzipped) and it is only reached through `supabase.auth.*`. Most
// visitors to a college website are signed out and never need it, so the
// client itself lives in `supabaseClient.js` behind a dynamic import: Vite
// emits it as its own chunk, loaded only when
//   * a session was persisted by an earlier visit (returning user), or
//   * the visitor is signing in (lib/auth.js asks for the client).
//
// `AUTH_STORAGE_KEY` mirrors the key @supabase/supabase-js stores the session
// under (`sb-<project-ref>-auth-token`), which is what makes that decision
// possible without loading the SDK first.
// ============================================================

function projectRef(url) {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    // Unconfigured / malformed VITE_SUPABASE_URL: supabaseClient.js throws a
    // clear error when it is loaded, so nothing else has to fail here.
    return '';
  }
}

function supabaseStorageKey(url) {
  const ref = projectRef(url);
  return ref ? `sb-${ref}-auth-token` : 'sb-auth-token';
}

/** localStorage key @supabase/supabase-js persists the session under. */
export const AUTH_STORAGE_KEY = supabaseStorageKey(import.meta.env.VITE_SUPABASE_URL);

let clientPromise = null;

/**
 * Load the Supabase client, at most once per page load.
 * Concurrent callers share the same request.
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('./supabaseClient.js').then(({ supabase }) => supabase);
    // A failed load (e.g. missing env vars) must not be cached forever.
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}

/**
 * True when a previous visit stored a Supabase session, i.e. this visitor is
 * (or was) signed in. Reading localStorage is the only way to know that
 * without importing the SDK.
 */
export function hasStoredSession() {
  try {
    return Boolean(globalThis.localStorage?.getItem(AUTH_STORAGE_KEY));
  } catch {
    // Private mode / storage disabled: treat the visitor as signed out.
    return false;
  }
}
