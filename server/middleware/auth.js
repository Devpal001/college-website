import { supabase } from '../lib/db.js';

// ============================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================
// All sensitive endpoints go through authRequired,
// which verifies the Supabase JWT server-side and
// attaches the resolved user + profile (role) to req.
//
// NOTE: Authorization is ALWAYS enforced server-side.
// The frontend role checks are only a UI convenience.

/**
 * Narrow profile identity projection used by authRequired.
 * Lifecycle + role enforcement only read id/role/status — the rest of the
 * row (institutional identity, contact fields, is_active legacy flag,
 * timestamps) is never consumed by any authenticated request, so every
 * request stops paying to move it.
 */
const PUBLIC_ROLES = ['student', 'teacher', 'admin', 'super_admin'];

// Every authenticated request fans out through authRequired +
// getStudent/TeacherForAuth, which used to SELECT the whole row. Identity
// checks only read id/role/status (profiles), placement fields (students),
// and employee linkage (teachers) — contact blobs, HR fields, legacy
// is_active and timestamps never leave the database on this path.
const AUTH_PROFILE_COLUMNS = 'id, email, full_name, role, status';
const STUDENT_IDENTITY_COLUMNS =
  'id, profile_id, enrollment_number, department_id, current_semester, current_section';
const TEACHER_IDENTITY_COLUMNS = 'id, profile_id, employee_id, department_id';

/**
 * Middleware: requires a valid Bearer JWT.
 * Attaches req.user (auth user) and req.profile (role profile).
 */
export async function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      console.warn(`[auth] 401 no token — ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn(
        `[auth] 401 invalid/expired token — ${req.method} ${req.originalUrl} (${error?.message || 'no user returned'})`
      );
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(AUTH_PROFILE_COLUMNS)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.warn(
        `[auth] 401 profile lookup failed — ${req.method} ${req.originalUrl} (${profileError?.message || 'no profile'})`
      );
      return res.status(401).json({ error: 'User profile not found' });
    }

          if (!PUBLIC_ROLES.includes(profile.role)) {
      return res.status(403).json({ error: 'Invalid role assigned to user' });
    }

    // Enforce account lifecycle at every request. Phase 2 hardening: a
    // suspended/disabled (or still-pending) account must never reach protected
    // APIs, regardless of how valid its JWT is.
    if (profile.status !== 'active') {
      console.warn(
        `[auth] 403 account not active — ${req.method} ${req.originalUrl} (status=${profile.status})`
      );
      return res.status(403).json({ error: 'Account is not active' });
    }

    req.user = { id: user.id, email: user.email };
    req.profile = profile;

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Middleware factory: requires the authenticated user to have
 * one of the given roles. Must be used AFTER authRequired.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

/**
 * Loads the student record for the authenticated user.
 * Returns null (with res response already sent) if the user has no student
 * record or the lookup fails.
 *
 * Error discrimination (never collapse these):
 * - Query succeeded, zero rows  -> 404 + code STUDENT_PROFILE_MISSING.
 *   The account is authenticated and role-detected, but no `students` row is
 *   linked to it: self-signup (handle_new_user trigger) creates a profiles row
 *   only — academic records are provisioned by administration
 *   (POST /api/users/admin) or the dev seed. Retrying cannot change this.
 * - Genuine database/service failure -> 500 + code STUDENT_LOOKUP_FAILED,
 *   logged server-side, retryable. A DB error must NEVER be reported as
 *   "profile not found".
 * @returns {Promise<object|null>} student record or null
 */
export async function getStudentForAuth(req, res) {
  // .maybeSingle() lets us tell "query succeeded, zero rows" (data === null,
  // error === null) apart from a real query failure (error set).
  const { data: student, error } = await supabase
    .from('students')
    .select(STUDENT_IDENTITY_COLUMNS)
    .eq('profile_id', req.user.id)
    .maybeSingle();

  if (!error && student === null) {
    res.status(404).json({
      error:
        'No student record is linked to this account yet. Please contact administration to complete your enrollment.',
      code: 'STUDENT_PROFILE_MISSING',
    });
    return null;
  }

  if (error) {
    console.error(
      `[auth] student lookup failed — ${req.method} ${req.originalUrl} (${error.message})`
    );
    res.status(500).json({
      error: 'Unable to load your student record right now. Please try again in a moment.',
      code: 'STUDENT_LOOKUP_FAILED',
    });
    return null;
  }

  return student;
}

/**
 * Loads the teacher record for the authenticated user.
 * Returns null (with res response already sent) if the user has no teacher
 * record or the lookup fails. Same discrimination contract as
 * getStudentForAuth (TEACHER_PROFILE_MISSING vs TEACHER_LOOKUP_FAILED).
 * @returns {Promise<object|null>} teacher record or null
 */
export async function getTeacherForAuth(req, res) {
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select(TEACHER_IDENTITY_COLUMNS)
    .eq('profile_id', req.user.id)
    .maybeSingle();

  if (!error && teacher === null) {
    res.status(404).json({
      error:
        'No teacher record is linked to this account yet. Please contact administration to complete your onboarding.',
      code: 'TEACHER_PROFILE_MISSING',
    });
    return null;
  }

  if (error) {
    console.error(
      `[auth] teacher lookup failed — ${req.method} ${req.originalUrl} (${error.message})`
    );
    res.status(500).json({
      error: 'Unable to load your teacher record right now. Please try again in a moment.',
      code: 'TEACHER_LOOKUP_FAILED',
    });
    return null;
  }

  return teacher;
}