import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/db.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { requireString, requireEmail } from '../lib/validate.js';
import { assertPasswordPolicy } from '../lib/password.js';
import {
  codeMatches,
  normalizeActivationCode,
  normalizeInstitutionalId,
} from '../lib/activation.js';

// ============================================
// PORTAL AUTHENTICATION (DEVELOPMENT / DEMO)
// ============================================
//
// ⚠️⚠️⚠️  DEMO-ONLY AUTHENTICATION — NOT PRODUCTION SECURE  ⚠️⚠️⚠️
//
// This router implements the ID-only portal login used for the current
// development/demo version of the MBSCET portal. A user picks a role
// (student / teacher / admin) and enters their institutional ID.
//
// Security model (demo-grade, on purpose):
//   1. The browser NEVER decides the role. The ID + requested role are
//      validated HERE against the database:
//        - students  → students.enrollment_number (+ profile.role)
//        - teachers  → teachers.employee_id     (+ profile.role)
//        - admins    → DEMO_ADMIN_IDS env mapping (ID=email → profiles.email)
//   2. On success this endpoint issues a REAL Supabase auth session
//      (access_token + refresh_token) via the admin API
//      (generateLink + verifyOtp server-side, no email is sent).
//   3. Everything downstream (useAuth, ProtectedRoute, server
//      authRequired/requireRole, RLS policies) keeps using the normal
//      Supabase JWT — no second competing auth system exists.
//   4. Simple in-memory rate limiting slows down ID guessing.
//
// 🔒 BEFORE PRODUCTION DEPLOYMENT this must be replaced with real
//    credentials (password / PIN / institutional SSO). The upgrade path
//    only touches this file + src/lib/auth.js (signInWithPortalId):
//    swap session issuance for supabase.auth.signInWithPassword or an
//    SSO flow — ProtectedRoute, dashboards and every API stay unchanged.
//    Set DISABLE_DEMO_LOGIN=true in .env to switch this endpoint off.

// ------------------------------------------------------------------
// FAIL-CLOSED DEMO GATE (Phase 2 hardening)
// ------------------------------------------------------------------
// Demo ID-only login must NEVER be the production authentication path.
// Resolution order (fail-closed by default):
//   1. DISABLE_DEMO_LOGIN=true   -> ALWAYS disabled (explicit kill switch).
//   2. DEMO_LOGIN_ENABLED=true   -> ALWAYS enabled (explicit dev/testing opt-in).
//   3. otherwise                 -> enabled ONLY outside production
//                                   (NODE_ENV !== 'production').
// Consequence: a production server with NO flags is demo-DISABLED. Demo is
// only ever active when an operator deliberately opts in with BOTH flags
// consistent (DISABLE != true AND DEMO_LOGIN_ENABLED == true) or runs a
// non-production NODE_ENV.
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEMO_LOGIN_ENABLED =
  process.env.DISABLE_DEMO_LOGIN === 'true'
    ? false
    : process.env.DEMO_LOGIN_ENABLED === 'true'
      ? true
      : NODE_ENV !== 'production';

const router = Router();

// Demo accounts are seeded by scripts/seed-demo.mjs.
// Admin portal IDs are configured via env (no schema changes needed):
//   DEMO_ADMIN_IDS="ADMIN001=demo-admin@mbscet.demo,ADMIN002=other@..."
const DEMO_ADMIN_IDS = String(process.env.DEMO_ADMIN_IDS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .reduce((map, entry) => {
    const idx = entry.indexOf('=');
    if (idx > 0) map[entry.slice(0, idx).trim().toUpperCase()] = entry.slice(idx + 1).trim();
    return map;
  }, {});

const ALLOWED_ROLES = ['student', 'teacher', 'admin'];

// --------------------------------------------
// Naive in-memory rate limiter (per IP).
// Demo-grade: fine for a single dev server, not for a cluster.
// --------------------------------------------
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const attemptLog = new Map(); // ip -> number[] (timestamps)

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = (attemptLog.get(ip) || []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  if (attempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
    attemptLog.set(ip, attempts);
    return true;
  }
  attempts.push(now);
  attemptLog.set(ip, attempts);
  return false;
}

// --------------------------------------------
// Helpers
// --------------------------------------------

/**
 * Look up a profile by portal ID. Resolved entirely server-side so the
 * frontend never gets to claim a role. Returns { profile } or null when
 * the ID is unknown for the selected portal.
 */
async function resolvePortalIdentity(portalId, role) {
  let query;
  if (role === 'student') {
    query = supabase
      .from('students')
      .select('*, profiles(*)')
      .eq('enrollment_number', portalId)
      .maybeSingle();
  } else if (role === 'teacher') {
    query = supabase
      .from('teachers')
      .select('*, profiles(*)')
      .eq('employee_id', portalId)
      .maybeSingle();
  } else {
    // role === 'admin' — dev/demo mapping from env (see header comment).
    const adminEmail = DEMO_ADMIN_IDS[portalId];
    if (!adminEmail) return null;
    query = supabase
      .from('profiles')
      .select('*')
      .eq('email', adminEmail)
      .maybeSingle();
  }

  const isProfileOnly = role === 'admin';
  try {
    const { data, error } = await query;
    if (error) throw error;
    if (isProfileOnly) return data ? { profile: data } : null;
    return data ? { profile: data.profiles } : null;
  } catch (err) {
    console.error(`[demo-login] resolve query failed (${role}, ${portalId})`, err.message);
    throw err;
  }
}

/**
 * Issue a real Supabase session for an existing auth user, server-side,
 * without sending any email: generate a magic link via the admin API and
 * immediately verify its token hash. Works even with "Confirm email"
 * enabled because the demo users are pre-verified by the seeder.
 *
 * CRITICAL: this runs against a DEDICATED throwaway client. Calling
 * verifyOtp on the shared service-role client would cache the user's
 * session in that GoTrueClient and it would then attach the USER's JWT
 * (not the service key) to every subsequent data request — re-enabling
 * RLS and breaking service-role queries with the "infinite recursion
 * detected in policy for relation profiles" error.
 */
async function issueSessionForUser(profile) {
  const sessionClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );

  const { data: linkData, error: linkError } = await sessionClient.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(linkError?.message || 'Could not generate sign-in link');
  }

  const { data: otpData, error: otpError } = await sessionClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (otpError || !otpData?.session) {
    throw new Error(otpError?.message || 'Could not verify sign-in token');
  }

  return {
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
    expires_in: otpData.session.expires_in,
    expires_at: otpData.session.expires_at,
    token_type: otpData.session.token_type || 'bearer',
  };
}

function safeProfile(profile) {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
  };
}


// ============================================
// POST /api/auth/demo-login
// Body: { portalId, role }  — role comes from the portal picker.
// ============================================
router.post('/demo-login', async (req, res) => {
  try {
    if (!DEMO_LOGIN_ENABLED) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (isRateLimited(req.ip || 'unknown')) {
      return res.status(429).json({
        error: 'Too many sign-in attempts. Please wait a minute and try again.',
      });
    }

    const portalId = String(req.body?.portalId || '').trim().toUpperCase();
    const role = String(req.body?.role || '').trim().toLowerCase();

    if (!portalId || portalId.length > 40) {
      return res.status(400).json({ error: 'Please enter your ID to continue.' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Please choose a portal (Student, Teacher or Admin).' });
    }

    // Steps 1+2: verify the ID exists AND belongs to the selected role
    // (validated server-side — the frontend choice is only a hint).
    const identity = await resolvePortalIdentity(portalId, role);

    if (!identity || !identity.profile) {
      return res.status(404).json({
        error: 'No account found for this ID. Check the ID and the selected portal, then try again.',
      });
    }

    const { profile } = identity;
    // super_admin accounts also sign in through the Admin portal.
    const effectiveRole =
      role === 'admin' && profile.role === 'super_admin' ? 'super_admin' : profile.role;

    // Account-enumeration hardening: whether the ID doesn't exist, belongs to a
    // different portal, or is inactive, return the SAME status + message so
    // responses never reveal which account (if any) an ID maps to.
    if (effectiveRole !== role || profile.is_active === false) {
      return res.status(404).json({
        error: 'No account found for this ID. Check the ID and the selected portal, then try again.',
      });
    }

    // Steps 3+4: create/maintain an authenticated session (real Supabase JWT).
    let session;
    try {
      session = await issueSessionForUser(profile);
    } catch (sessionError) {
      // Never leak Supabase internals to the client.
      console.error('[demo-login] Session issuance failed:', sessionError?.message);
      return res.status(502).json({
        error: 'Sign-in service is temporarily unavailable. Please try again in a moment.',
      });
    }

    // Step 5: audit trail (existing audit_logs table).
    try {
      await supabase.from('audit_logs').insert({
        user_id: profile.id,
        action: 'demo_login',
        table_name: 'profiles',
        record_id: profile.id,
        new_values: { portal_id: portalId, role },
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
      });
    } catch (auditError) {
      // Audit logging must never block sign-in.
      console.warn('[demo-login] Audit log insert failed:', auditError?.message);
    }

    // Steps 6+7: ProtectedRoute / dashboards consume this role via useAuth.
    return res.json({
      session,
      user: { id: profile.id, email: profile.email },
      profile: safeProfile(profile),
      portal: { portalId, role },
    });
  } catch (error) {
    // Generic message only — never expose database errors to the user.
    console.error('[demo-login] Unexpected error:', error?.message);
    if (process.env.DEBUG_AUTH) console.error('[demo-login] stack:', error?.stack?.split('\n').slice(0, 4).join('\n'));
    return res.status(500).json({
      error: 'Sign-in is temporarily unavailable. Please try again in a moment.',
    });
  }
});

// ============================================
// POST /api/auth/activate  (Phase 1 — public, rate-limited)
// Body: { institutionalId, email, activationCode, password }
// ============================================
// Activates a PENDING institutional account registered by administration:
//   institutional ID + institutional email + one-time code + new password
//     -> password set on the pre-created auth user (service role)
//     -> activation code burned (single use)
//     -> profile status pending -> active (sync trigger flips is_active)
//
// SECURITY:
//   - Every rejection below returns the SAME generic message + code so
//     nothing about account existence, email or state leaks
//     (no enumeration); details are logged server-side only.
//   - The code is compared timing-safe against its stored SHA-256 hash.
//   - Passwords follow the shared policy (server/lib/password.js) and are
//     handled exclusively by Supabase GoTrue — never stored by this app.
//   - The role is NEVER accepted from the client; it already lives on the
//     authoritative profile created by the registry.
// ============================================
const ACTIVATION_GENERIC_ERROR =
  'Activation failed. Check your institutional ID, institutional email and activation code, then try again.';

// --------------------------------------------
// PHASE 2: Institutional ID + password login
// --------------------------------------------
// Public endpoint (no session yet). Replaces the demo ID-only login as the
// production authentication path. The selected `portal` is UI context only;
// the authoritative role always comes from the database profile.
//
// Flow:
//   1. Resolve profile by profiles.institutional_id (authoritative identity).
//   2. Enforce status === 'active' (deny pending/suspended/disabled).
//   3. Authenticate the password server-side via supabase.signInWithPassword
//      using the service-role client (the service key never reaches the browser).
//   4. Authorize: if a portal was selected, it must match the DB role.
//   5. Return session + safe profile summary. UseAuth/ProtectedRoute pick up
//      the role via the normal JWT — no second auth system.
const LOGIN_GENERIC_ERROR =
  'Login failed. Check your institutional ID and password, then try again.';

router.post('/login', async (req, res) => {
  try {
    if (isRateLimited(req.ip || 'unknown')) {
      return res.status(429).json({
        error: 'Too many attempts. Please wait a minute and try again.',
      });
    }

    const institutionalId = normalizeInstitutionalId(
      requireString(req.body?.institutionalId, 'institutionalId', { min: 2, max: 40 })
    );
    const password = requireString(req.body?.password, 'password', { min: 6, max: 128 });
    const portal = req.body?.portal; // UI context only — not trusted for authorization

    const fail = () => HttpError.badRequest(LOGIN_GENERIC_ERROR, 'LOGIN_FAILED');

    // 1) Resolve identity by authoritative institutional_id.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, institutional_id')
      .eq('institutional_id', institutionalId)
      .maybeSingle();
    if (profileError) throw profileError;

    // 2) Reject unknown identities (same message as a wrong password to avoid
    //    confirming which institutional IDs exist) and non-active accounts.
    if (!profile) {
      console.warn(`[login] rejected — ${req.method} ${req.originalUrl} (unknown institutional id)`);
      throw fail();
    }
    if (profile.status !== 'active') {
      console.warn(
        `[login] rejected — ${req.method} ${req.originalUrl} (status=${profile.status})`
      );
      throw fail();
    }

    // 3) Authenticate the password server-side. signInWithPassword against the
    //    service-role client performs the same credential verification GoTrue
    //    would for a browser client — without exposing the service key.
    const email = profile.email;
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData?.session) {
      console.warn(
        `[login] rejected — ${req.method} ${req.originalUrl} (bad credentials, email=${email})`
      );
      throw fail();
    }

    const session = authData.session;

    // 4) Authorize against the DATABASE role, not the frontend selection.
    //    If a portal was selected, it must match the authoritative role.
    if (portal && portal !== profile.role && !(portal === 'super_admin' && profile.role === 'admin')) {
      console.warn(
        `[login] portal mismatch — ${req.method} ${req.originalUrl} (selected=${portal}, actual=${profile.role})`
      );
      return res.status(403).json({
        error: 'This account is not authorized for this portal.',
        code: 'PORTAL_MISMATCH',
        user: { id: profile.id, email: profile.email },
        profile: safeProfile(profile),
      });
    }

    // 5) Audit trail (non-blocking).
    try {
      await supabase.from('audit_logs').insert({
        user_id: profile.id,
        action: 'auth.login',
        table_name: 'profiles',
        record_id: profile.id,
        new_values: { role: profile.role, portal_selected: portal || null },
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
      });
    } catch (auditError) {
      // Audit logging must never block authentication.
      console.warn('[login] audit log insert failed:', auditError?.message);
    }

    // 6) Steps 7+ (ProtectedRoute / dashboards) consume this role via useAuth.
    return res.json({
      session,
      user: { id: profile.id, email: profile.email },
      profile: safeProfile(profile),
      portal: { institutionalId, role: profile.role },
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/activate', async (req, res) => {
  try {
    if (isRateLimited(req.ip || 'unknown')) {
      return res.status(429).json({
        error: 'Too many attempts. Please wait a minute and try again.',
      });
    }

    const institutionalId = normalizeInstitutionalId(
      requireString(req.body?.institutionalId, 'institutionalId', { min: 2, max: 40 })
    );
    const email = requireEmail(req.body?.email, 'email');
    const code = normalizeActivationCode(req.body?.activationCode);
    requireString(code, 'activationCode', { min: 8, max: 64 });
    assertPasswordPolicy(req.body?.password);
    const password = req.body.password;

    const fail = () => HttpError.badRequest(ACTIVATION_GENERIC_ERROR, 'ACTIVATION_FAILED');

    // 1) Resolve the authoritative record.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('institutional_id', institutionalId)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profile || profile.status !== 'pending' || profile.email.toLowerCase() !== email) {
      console.warn(
        `[activate] rejected — ${req.method} ${req.originalUrl} (${
          !profile
            ? 'unknown institutional id'
            : profile.status !== 'pending'
              ? `status=${profile.status}`
              : 'email mismatch'
        })`
      );
      throw fail();
    }

    // 2) One-time activation code: present, unused, unexpired, matching.
    const { data: activation, error: activationError } = await supabase
      .from('account_activations')
      .select('code_hash, expires_at, used_at')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (activationError) throw activationError;
    const codeInvalid =
      !activation ||
      activation.used_at ||
      new Date(activation.expires_at).getTime() < Date.now() ||
      !codeMatches(code, activation.code_hash);
    if (codeInvalid) {
      console.warn(`[activate] rejected — ${req.method} ${req.originalUrl} (code invalid/expired/used)`);
      throw fail();
    }

    // 3) Set the password on the pre-created auth user (service role).
    const { error: passwordError } = await supabase.auth.admin.updateUserById(profile.id, {
      password,
    });
    if (passwordError) {
      console.error('[activate] password update failed:', passwordError.message);
      throw new Error('activation password update failed');
    }

    // 4) Burn the code — guarded so only a still-unused code is consumed.
    const { error: burnError } = await supabase
      .from('account_activations')
      .update({ used_at: new Date().toISOString() })
      .eq('profile_id', profile.id)
      .is('used_at', null);
    if (burnError) throw burnError;

    // 5) pending -> active (the sync trigger flips is_active with it).
    const { error: statusError } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', profile.id)
      .eq('status', 'pending');
    if (statusError) throw statusError;

    // 6) Audit trail.
    try {
      await supabase.from('audit_logs').insert({
        user_id: profile.id,
        action: 'account.activated',
        table_name: 'profiles',
        record_id: profile.id,
        new_values: { institutional_id: institutionalId, role: profile.role },
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
      });
    } catch (auditError) {
      console.warn('[activate] audit log insert failed:', auditError?.message);
    }

    return res.json({
      data: {
        activated: true,
        role: profile.role,
        fullName: profile.full_name,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;

