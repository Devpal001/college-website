import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/db.js';

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

const DEMO_LOGIN_ENABLED = process.env.DISABLE_DEMO_LOGIN !== 'true';

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

    if (effectiveRole !== role) {
      return res.status(403).json({
        error: `This ID does not belong to the ${role} portal. Choose the correct portal and try again.`,
      });
    }

    if (profile.is_active === false) {
      return res.status(403).json({
        error: 'This account is inactive. Please contact the college administration.',
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

export default router;

