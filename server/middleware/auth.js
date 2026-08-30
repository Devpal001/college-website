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

const PUBLIC_ROLES = ['student', 'teacher', 'admin', 'super_admin'];

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
      .select('*')
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
 * Returns null (with res response already sent) if the user is not a student.
 * @returns {Promise<object|null>} student record or null
 */
export async function getStudentForAuth(req, res) {
  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', req.user.id)
    .single();

  if (error || !student) {
    res.status(404).json({ error: 'Student profile not found. Contact administration.' });
    return null;
  }

  return student;
}

/**
 * Loads the teacher record for the authenticated user.
 * Returns null (with res response already sent) if the user is not a teacher.
 * @returns {Promise<object|null>} teacher record or null
 */
export async function getTeacherForAuth(req, res) {
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('profile_id', req.user.id)
    .single();

  if (error || !teacher) {
    res.status(404).json({ error: 'Teacher profile not found. Contact administration.' });
    return null;
  }

  return teacher;
}