// Re-use the single shared Supabase client through the loader in
// lib/supabase.js. Creating a second client with the same storage key caused
// the "Multiple GoTrueClient instances detected" console warning and could
// make auth-state updates unreliable; going through the loader also keeps the
// SDK out of the initial bundle for signed-out visitors. Every helper below
// awaits getSupabase() instead of holding a module-level reference, and calls
// ensureAuthTracking() first so the session store is subscribed BEFORE the
// SIGNED_IN / SIGNED_OUT event produced by the action it is about to run.
import { getSupabase } from './supabase';
import { ensureAuthTracking } from './sessionStore';
import { api } from './api';

// ============================================
// AUTHENTICATION HELPERS
// ============================================

// ============================================
// PORTAL (DEMO) AUTHENTICATION
// ============================================

/**
 * Sign in through the MBSCET portal using an institutional ID + portal role.
 * The Express backend (/api/auth/demo-login) verifies the ID against the
 * database server-side (students.enrollment_number / teachers.employee_id /
 * DEMO_ADMIN_IDS) and returns a real Supabase session — the frontend never
 * decides the role. On success the session is stored so useAuth,
 * ProtectedRoute and the Navbar pick it up through the normal flow.
 *
 * ⚠️ DEMO-ONLY by design — ID-only, not production-secure. Replace with
 *    password/PIN/SSO before production deployment (see server/routes/auth.js
 *    and the banner on the /login page).
 */
export async function signInWithPortalId(portalId, role) {
  // POST is intentionally unauthenticated (no session exists yet).
  const { session, profile, user } = await api.post('/auth/demo-login', {
    portalId,
    role,
  });

  // Maintain a real Supabase session for the remainder of the app session.
  await ensureAuthTracking();
  const supabase = await getSupabase();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;

  return { session, profile, user };
}

/**
 * Role → portal dashboard route (single source of truth).
 */
export function dashboardPathForRole(role) {
  if (role === 'student') return '/student-dashboard';
  if (role === 'teacher') return '/teacher-dashboard';
  if (role === 'admin' || role === 'super_admin') return '/admin-dashboard';
  return '/login';
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  await ensureAuthTracking();
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  // Phase 3 account-status enforcement: the API (authRequired) rejects
  // non-active accounts, so one probe of /auth/me is enough to keep the
  // frontend out of a logged-in-but-blocked state. This is the same
  // server-side check the rest of the app relies on — the browser no longer
  // queries the `profiles` table directly.
  try {
    await getCurrentProfile();
  } catch {
    await supabase.auth.signOut();
    throw new Error('Account is not active');
  }

  return data;
}

/**
 * Sign in with a college-issued institutional ID + password.
 * The backend (/api/auth/login) resolves the profile by institutional_id
 * and authenticates the password server-side — the browser never sees the
 * service key, and the selected portal is UI context only (the authoritative
 * role comes from the database). On success the issued session is stored so
 * useAuth / ProtectedRoute / Navbar pick it up via the normal flow.
 */
export async function signInWithInstitutionalId(institutionalId, password, portal) {
  const { session, profile, user, portal: resolvedPortal } = await api.post('/auth/login', {
    institutionalId,
    password,
    portal,
  });

  await ensureAuthTracking();
  const supabase = await getSupabase();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;

  return { session, profile, user, portal: resolvedPortal };
}

/**
 * Sign out current user
 */
export async function signOut() {
  await ensureAuthTracking();
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = await getSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ============================================
// USER PROFILE HELPERS
// ============================================

/**
 * Role + profile of the signed-in user, resolved SERVER-SIDE.
 *
 * GET /api/auth/me runs the authRequired middleware, which validates the JWT,
 * loads the profile and rejects pending/suspended/disabled accounts. The
 * browser therefore never decides which role it is shown, and no component
 * reads the `profiles` table directly.
 */
export async function getCurrentProfile() {
  const { profile } = await api.get('/auth/me');
  if (!profile) throw new Error('Profile not found');
  return profile;
}

