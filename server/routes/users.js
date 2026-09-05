import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { assertPasswordPolicy, generateRandomPassword } from '../lib/password.js';
import {
  generateActivationCode,
  hashActivationCode,
  normalizeInstitutionalId,
  ACTIVATION_CODE_TTL_HOURS,
} from '../lib/activation.js';
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

// Password policy is shared with the activation flow (server/lib/password.js);
// provisioning and activation enforce the exact same requirements.

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
// COLLEGE IDENTITY REGISTRY (Phase 1)
// ============================================
// POST /api/users/registry — register an AUTHORITATIVE college identity
// as a PENDING account and issue a one-time activation code:
//   auth user (random password nobody knows)
//     -> profile (status='pending', institutional_id)
//     -> role-specific record (created up front, so an activated account
//        is immediately complete — no half-accounts)
//     -> account_activations row (SHA-256 code hash, single-use, expiring)
// The person activates via POST /api/auth/activate with institutional ID +
// institutional email + code + a new password. The ROLE always comes from
// the record created here — the person never chooses one.
// ============================================
router.post('/registry', async (req, res) => {
  try {
    const institutionalId = normalizeInstitutionalId(
      requireString(req.body?.institutionalId, 'institutionalId', { min: 2, max: 40 })
    );
    const email = requireEmail(req.body?.email, 'email');
    const fullName = requireString(req.body?.fullName, 'fullName', { min: 2, max: 120 });
    const role = requireOneOf(req.body?.role, 'role', ROLES);

    // Role-escalation safeguard (same as POST /admin).
    if (role === 'super_admin' && req.profile.role !== 'super_admin') {
      throw HttpError.forbidden('Only a super admin can create super admin accounts');
    }

    const departmentId = req.body?.departmentId
      ? requireUuid(req.body.departmentId, 'departmentId')
      : null;
    const semesterNumber = req.body?.semesterNumber
      ? requireNumber(req.body.semesterNumber, 'semesterNumber', { min: 1, max: 10, integer: true })
      : null;
    const sectionId = req.body?.sectionId ? requireUuid(req.body.sectionId, 'sectionId') : null;

    // The institutional identity must be free before we touch auth.
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('institutional_id', institutionalId)
      .maybeSingle();
    if (taken) {
      throw HttpError.conflict(`Institutional ID ${institutionalId} is already assigned`);
    }

    // 1) Auth user with a random password nobody knows — the account is
    //    unusable until the person activates with the code + new password.
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: generateRandomPassword(),
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
      // 2) Profile (the handle_new_user trigger created it): reconcile the
      //    fields we control and mark the account PENDING. The sync trigger
      //    keeps is_active=false while status is 'pending'.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: authUserId,
            email,
            full_name: fullName,
            role,
            institutional_id: institutionalId,
            status: 'pending',
          },
          { onConflict: 'id' }
        );
      if (profileError) throw profileError;

      // 3) Role-specific record. The institutional ID doubles as the
      //    academic code (enrollment_number / employee_id), preserving the
      //    existing UNIQUE constraints and the Phase 0 backfill mapping.
      if (role === 'student') {
        const { error: studentError } = await supabase.from('students').insert({
          profile_id: authUserId,
          enrollment_number: institutionalId,
          department_id: departmentId,
          current_semester: semesterNumber != null ? String(semesterNumber) : null,
          current_section: sectionId,
        });
        if (studentError) {
          if (studentError.code === '23505') {
            throw HttpError.conflict(`Institutional ID ${institutionalId} is already assigned`);
          }
          throw studentError;
        }
      } else if (role === 'teacher') {
        const { error: teacherError } = await supabase.from('teachers').insert({
          profile_id: authUserId,
          employee_id: institutionalId,
          department_id: departmentId,
        });
        if (teacherError) {
          if (teacherError.code === '23505') {
            throw HttpError.conflict(`Institutional ID ${institutionalId} is already assigned`);
          }
          throw teacherError;
        }
      }

      // 4) One-time activation code — stored hashed, single-use, expiring.
      const activationCode = generateActivationCode();
      const expiresAt = new Date(
        Date.now() + ACTIVATION_CODE_TTL_HOURS * 60 * 60 * 1000
      ).toISOString();
      const { error: activationError } = await supabase
        .from('account_activations')
        .upsert(
          {
            profile_id: authUserId,
            code_hash: hashActivationCode(activationCode),
            expires_at: expiresAt,
            used_at: null,
            created_by: req.profile.id,
          },
          { onConflict: 'profile_id' }
        );
      if (activationError) throw activationError;

      // 5) Audit trail (never log the code or any credential material).
      try {
        await supabase.from('audit_logs').insert({
          user_id: req.profile.id,
          action: 'account.registry_created',
          table_name: 'profiles',
          record_id: authUserId,
          new_values: {
            email,
            role,
            full_name: fullName,
            institutional_id: institutionalId,
          },
          ip_address: req.ip,
          user_agent: req.get('user-agent')?.slice(0, 300) || null,
        });
      } catch (auditErr) {
        console.error('[users] audit log write failed', auditErr.message);
      }

      // The raw code is returned exactly once — deliver it out-of-band
      // (same channel the college uses to hand out institutional IDs).
      return res.status(201).json({
        data: {
          id: authUserId,
          email,
          full_name: fullName,
          role,
          institutional_id: institutionalId,
          status: 'pending',
          activationCode,
          activationExpiresAt: expiresAt,
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
// POST /api/users/registry/reissue — fresh activation code for a
// still-pending registry account (e.g. the previous code expired).
// ============================================
router.post('/registry/reissue', async (req, res) => {
  try {
    const institutionalId = normalizeInstitutionalId(
      requireString(req.body?.institutionalId, 'institutionalId', { min: 2, max: 40 })
    );

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('institutional_id', institutionalId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      throw HttpError.notFound('No registry entry found for this institutional ID');
    }
    if (profile.status !== 'pending') {
      throw HttpError.conflict('This account is not awaiting activation');
    }

    const activationCode = generateActivationCode();
    const expiresAt = new Date(
      Date.now() + ACTIVATION_CODE_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();
    const { error: activationError } = await supabase
      .from('account_activations')
      .upsert(
        {
          profile_id: profile.id,
          code_hash: hashActivationCode(activationCode),
          expires_at: expiresAt,
          used_at: null,
          created_by: req.profile.id,
        },
        { onConflict: 'profile_id' }
      );
    if (activationError) throw activationError;

    try {
      await supabase.from('audit_logs').insert({
        user_id: req.profile.id,
        action: 'account.activation_code_reissued',
        table_name: 'profiles',
        record_id: profile.id,
        new_values: { institutional_id: institutionalId },
        ip_address: req.ip,
        user_agent: req.get('user-agent')?.slice(0, 300) || null,
      });
    } catch (auditErr) {
      console.error('[users] audit log write failed', auditErr.message);
    }

    // Raw code returned exactly once.
    return res.json({
      data: {
        institutional_id: institutionalId,
        activationCode,
        activationExpiresAt: expiresAt,
      },
    });
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
        'id, email, full_name, role, status, is_active, created_at, students(enrollment_number), teachers(employee_id)',
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

