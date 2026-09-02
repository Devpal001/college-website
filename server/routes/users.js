import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError, sendError } from '../lib/httpError.js';
import {
  requireUuid,
  requireString,
  requireEmail,
  requireOneOf,
  requireNumber,
  pagination,
} from '../lib/validate.js';

// ============================================================
// ADMIN USER PROVISIONING (Phase 2 completion)
// ------------------------------------------------------------
// Production accounts are provisioned by ADMINS, not self-signup.
// One endpoint creates: auth user -> profile -> role row.
// Rollback on any failure: auth.admin.deleteUser() cascades through
// profiles and role rows (all ON DELETE CASCADE from auth.users).
//
// SECURITY:
// - admin/super_admin only (router-level guard below)
// - every input validated server-side (never trust req.body)
// - emails lowercased; duplicate -> 409 CONFLICT
// - passwords must meet the policy below
// - role escalation safeguard: only super_admin can mint super_admin
// - every creation is audit-logged
// ============================================================

const ROLES = ['student', 'teacher', 'admin', 'super_admin'];

// Password policy (aligns with Supabase's default minimum of 6;
// we require stronger for production accounts).
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 72; // Supabase/GoTrue caps at 72 bytes

function assertPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw HttpError.badRequest('Password is required', 'INVALID_PASSWORD');
  }
  if (password.length < PASSWORD_MIN) {
    throw HttpError.badRequest(
      `Password must be at least ${PASSWORD_MIN} characters`,
      'INVALID_PASSWORD'
    );
  }
  if (password.length > PASSWORD_MAX) {
    throw HttpError.badRequest(
      `Password must be at most ${PASSWORD_MAX} characters`,
      'INVALID_PASSWORD'
    );
  }
  if (!/[a-z]/.test(password)) {
    throw HttpError.badRequest('Password must contain a lowercase letter', 'INVALID_PASSWORD');
  }
  if (!/[A-Z]/.test(password)) {
    throw HttpError.badRequest('Password must contain an uppercase letter', 'INVALID_PASSWORD');
  }
  if (!/[0-9]/.test(password)) {
    throw HttpError.badRequest('Password must contain a digit', 'INVALID_PASSWORD');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw HttpError.badRequest(
      'Password must contain a symbol (non-alphanumeric character)',
      'INVALID_PASSWORD'
    );
  }
}

// ============================================
// Router-level guard: EVERY route below is admin/super_admin only.
// ============================================
const router = Router();
router.use(authRequired, requireRole('admin', 'super_admin'));

// ============================================
// POST /api/users/admin — provision a new account
// Body: { email, password, fullName, role, + role-specific fields }
// ============================================
router.post('/admin', async (req, res) => {
  try {
    const email = requireEmail(req.body?.email, 'email');
    const password = req.body?.password;
    assertPasswordPolicy(password);
    const fullName = requireString(req.body?.fullName, 'fullName', { min: 2, max: 120 });
    const role = requireOneOf(req.body?.role, 'role', ROLES);

    // Role-escalation safeguard: only super_admin can mint a super_admin.
    if (role === 'super_admin' && req.profile.role !== 'super_admin') {
      throw HttpError.forbidden('Only a super admin can create super admin accounts');
    }

    // Role-specific validated fields.
    const departmentId = req.body?.departmentId
      ? requireUuid(req.body.departmentId, 'departmentId')
      : null;
    const enrollmentNumber =
      role === 'student'
        ? requireString(req.body?.enrollmentNumber, 'enrollmentNumber', { min: 2, max: 40 })
        : null;
    const employeeId =
      role === 'teacher'
        ? requireString(req.body?.employeeId, 'employeeId', { min: 2, max: 40 })
        : null;
    const semesterNumber = req.body?.semesterNumber
      ? requireNumber(req.body.semesterNumber, 'semesterNumber', {
          min: 1,
          max: 10,
          integer: true,
        })
      : null;
    const sectionId = req.body?.sectionId ? requireUuid(req.body.sectionId, 'sectionId') : null;

    // 1) Create the auth user (email pre-confirmed; admin delivers the
    //    password out-of-band — no invite emails in this flow).
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (createError) {
      const msg = String(createError.message || '');
      if (/already.{0,20}registered|duplicate/i.test(msg)) {
        throw HttpError.conflict('An account with this email already exists');
      }
      throw new Error(`auth.admin.createUser failed: ${msg}`);
    }
    const authUserId = created.user?.id;
    if (!authUserId) {
      throw new Error('auth.admin.createUser returned no user id');
    }

    try {
      // 2) The handle_new_user() trigger created a profiles row from
      //    user_metadata. Reconcile the fields we control (guards
      //    against trigger drift or metadata loss).
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: authUserId, email, full_name: fullName, role, is_active: true },
          { onConflict: 'id' }
        )
        .select()
        .single();
      if (profileError) throw profileError;

      // 3) Role row. students.enrollment_number and teachers.employee_id
      //    are UNIQUE — a duplicate surfaces as 409 with rollback below.
      if (role === 'student') {
        const { error: studentError } = await supabase.from('students').insert({
          profile_id: authUserId,
          enrollment_number: enrollmentNumber,
          department_id: departmentId,
          current_semester: semesterNumber != null ? String(semesterNumber) : null,
          current_section: sectionId,
        });
        if (studentError) {
          if (studentError.code === '23505') {
            throw HttpError.conflict(
              `Enrollment number ${enrollmentNumber} is already assigned`
            );
          }
          throw studentError;
        }
      } else if (role === 'teacher') {
        const { error: teacherError } = await supabase.from('teachers').insert({
          profile_id: authUserId,
          employee_id: employeeId,
          department_id: departmentId,
        });
        if (teacherError) {
          if (teacherError.code === '23505') {
            throw HttpError.conflict(`Employee ID ${employeeId} is already assigned`);
          }
          throw teacherError;
        }
      }

      // 4) Audit log (best-effort — never blocks a successful provision).
      try {
        await supabase.from('audit_logs').insert({
          user_id: req.profile.id,
          action: 'user.provisioned',
          table_name: 'profiles',
          record_id: authUserId,
          new_values: {
            email,
            role,
            full_name: fullName,
            enrollment_number: enrollmentNumber,
            employee_id: employeeId,
            department_id: departmentId,
          },
          ip_address: req.ip,
          user_agent: req.get('user-agent')?.slice(0, 300) || null,
        });
      } catch (auditErr) {
        console.error('[users] audit log write failed', auditErr.message);
      }

      return res.status(201).json({
        data: {
          id: authUserId,
          email,
          full_name: fullName,
          role,
          department_id: departmentId,
          enrollment_number: enrollmentNumber,
          employee_id: employeeId,
        },
      });
    } catch (innerErr) {
      // ROLLBACK: remove the auth user; profiles + role rows cascade.
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (rbErr) {
        console.error('[users] ROLLBACK FAILED — orphaned auth user', authUserId, rbErr.message);
      }
      throw innerErr;
    }

  } catch (err) {
    sendError(res, err);
  }
});

// ============================================
// GET /api/users/admin — paginated, searchable user list
// Query: ?role=student|teacher|admin|super_admin&q=<search>&page=1&limit=25
// ============================================
router.get('/admin', async (req, res) => {
  try {
    const { limit, page, offset } = pagination(req, { defaultLimit: 25, maxLimit: 100 });
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const roleFilter = req.query.role
      ? requireOneOf(req.query.role, 'role', ROLES)
      : null;

    let query = supabase
      .from('profiles')
      .select(
        'id, email, full_name, role, is_active, created_at, students(enrollment_number), teachers(employee_id)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (roleFilter) query = query.eq('role', roleFilter);
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({
      data,
      meta: { page, limit, total: count ?? data.length },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;

