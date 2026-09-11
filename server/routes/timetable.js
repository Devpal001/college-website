import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { sendError } from '../lib/httpError.js';
import { isUuid } from '../lib/validate.js';

/**
 * Protected timetable management API (mounted at /api/timetable).
 *
 * Data model: the existing normalized `timetable` table (schema.sql).
 * Lectures reference sections/subjects/teachers/rooms/semesters by
 * foreign key, so no names are duplicated as free text.
 *
 * Authorization:
 * - GET (list): authenticated users; teachers see only their own lectures,
 *   students only their section's, admins everything.
 * - Mutations (POST/PUT/DELETE): admins + super_admins only, validated
 *   server-side. Teachers do NOT edit the timetable in this build.
 */

const router = Router();

const DAY_SET = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);

const TIMETABLE_SELECT =
  '*, subjects(*), sections(*, semesters(*, courses(*))), teachers(*, profiles(full_name)), rooms(*), semesters(*)';

// All routes require authentication.
router.use(authRequired);

/** Resolve the teacher row linked to the authenticated profile (may be null). */
async function getLinkedTeacher(profileId) {
  const { data } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  return data || null;
}

/**
 * Resolve the student row linked to the authenticated profile (may be null).
 */
async function getLinkedStudent(profileId) {
  const { data } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  return data || null;
}

/**
 * Resolve the student's current section via their ACTIVE ENROLLMENT.
 * Note: students.current_section is a free-text label, not the sections.id
 * FK, so it must never be compared against timetable.section_id (a UUID).
 * The latest enrollment row carries the authoritative section_id FK.
 */
async function getStudentCurrentSection(studentId) {
  const { data } = await supabase
    .from('enrollments')
    .select('section_id')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0]?.section_id || null;
}

/**
 * Verify a lecture reference exists. Returns {ok, error?} - when a nullable
 * reference is explicitly null the check passes.
 */
async function referenceExists(table, id, field, { nullable = false } = {}) {
  if (id === undefined) return { ok: true };
  if (id === null || id === '') {
    return nullable ? { ok: true } : { ok: false, error: `${field} is required` };
  }
  if (!isUuid(id)) return { ok: false, error: `${field} must be a valid UUID` };
  const { data, error } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  if (error) return { ok: false, error: `${field} lookup failed` };
  if (!data) return { ok: false, error: `${field} does not exist` };
  return { ok: true };
}

/** Validate and normalize a lecture payload for create/update. */
async function validateLecturePayload(body, { partial = false } = {}) {
  const errors = [];
  const payload = {};

  // section_id / subject_id / teacher_id / semester_id are required FKs.
  for (const [field, table] of [
    ['section_id', 'sections'],
    ['subject_id', 'subjects'],
    ['teacher_id', 'teachers'],
    ['semester_id', 'semesters'],
  ]) {
    const value = body[field];
    if (value === undefined && partial) continue;
    const check = await referenceExists(table, value, field);
    if (!check.ok) errors.push(check.error);
    else payload[field] = value;
  }

  // room_id is a nullable FK (ON DELETE SET NULL in the schema).
  const roomValue = body.room_id;
  if (roomValue !== undefined) {
    if (roomValue === null || roomValue === '') {
      payload.room_id = null;
    } else {
      const check = await referenceExists('rooms', roomValue, 'room_id', { nullable: true });
      if (!check.ok) errors.push(check.error);
      else payload.room_id = roomValue;
    }
  } else if (!partial) {
    payload.room_id = null;
  }

  // day_of_week enum.
  if (body.day_of_week !== undefined) {
    if (!DAY_SET.has(body.day_of_week)) {
      errors.push('day_of_week must be one of: ' + [...DAY_SET].join(', '));
    } else {
      payload.day_of_week = body.day_of_week;
    }
  } else if (!partial) {
    errors.push('day_of_week is required');
  }

  // start_time / end_time (TIME - HH:MM or HH:MM:SS).
  const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
  for (const field of ['start_time', 'end_time']) {
    const value = body[field];
    if (value === undefined && partial) continue;
    if (typeof value !== 'string' || !TIME_RE.test(value.trim())) {
      errors.push(`${field} must be a time in HH:MM format`);
      continue;
    }
    payload[field] = value.trim();
  }
  if (
    payload.start_time &&
    payload.end_time &&
    String(payload.start_time).localeCompare(String(payload.end_time)) >= 0
  ) {
    errors.push('end_time must be after start_time');
  }

  // academic_year is optional free text.
  if (body.academic_year !== undefined) {
    const year = body.academic_year === null ? null : String(body.academic_year).trim();
    if (year && year.length > 20) {
      errors.push('academic_year must be at most 20 characters');
    } else {
      payload.academic_year = year || null;
    }
  }

  return { ok: errors.length === 0, errors, payload };
}

// ============================================
// GET /api/timetable
// Role-scoped lecture listing.
// ============================================
router.get('/', async (req, res) => {
  try {
    const role = req.profile.role;
    let query = supabase.from('timetable').select(TIMETABLE_SELECT);

    if (role === 'teacher') {
      const teacher = await getLinkedTeacher(req.user.id);
      if (!teacher) return res.json([]);
      query = query.eq('teacher_id', teacher.id);
    } else if (role === 'student') {
      const student = await getLinkedStudent(req.user.id);
      const currentSection = student ? await getStudentCurrentSection(student.id) : null;
      const sectionId = req.query.sectionId;
      // Students may only ever see their own section's timetable.
      if (sectionId && sectionId !== currentSection) {
        return res.status(403).json({ error: 'You can only view your own class timetable' });
      }
      if (!currentSection) return res.json([]);
      query = query.eq('section_id', currentSection);
    }
    // admin / super_admin: unfiltered (required for the management workflow).

    if (req.query.dayOfWeek && DAY_SET.has(req.query.dayOfWeek)) {
      query = query.eq('day_of_week', req.query.dayOfWeek);
    }

    const { data, error } = await query.order('day_of_week').order('start_time');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get timetable error:', error);
    sendError(res, error);
  }
});

// ============================================
// Everything below is admin-only.
// ============================================
router.use(requireRole('admin', 'super_admin'));

// ============================================
// GET /api/timetable/meta/teachers
// Lightweight teacher directory for the manager forms.
// (Declared before the /:id routes so Express resolves the
// literal path first.)
// ============================================
router.get('/meta/teachers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, employee_id, profiles(full_name)')
      .order('employee_id');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get timetable meta teachers error:', error);
    sendError(res, error);
  }
});

// ============================================
// POST /api/timetable
// Create a lecture (admin only).
// ============================================
router.post('/', async (req, res) => {
  try {
    const { ok, errors, payload } = await validateLecturePayload(req.body || {});
    if (!ok) return res.status(400).json({ error: errors.join('; ') });

    const { data, error } = await supabase
      .from('timetable')
      .insert(payload)
      .select(TIMETABLE_SELECT)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Create timetable lecture error:', error);
    sendError(res, error);
  }
});

// ============================================
// PUT /api/timetable/:id
// Update a lecture (admin only). Partial payload; only
// provided fields are changed.
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid timetable id' });

    const { ok, errors, payload } = await validateLecturePayload(req.body || {}, { partial: true });
    if (!ok) return res.status(400).json({ error: errors.join('; ') });
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    // Verify the lecture exists before updating.
    const existing = await supabase.from('timetable').select('id').eq('id', id).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return res.status(404).json({ error: 'Lecture not found' });

    const { data, error } = await supabase
      .from('timetable')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(TIMETABLE_SELECT)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update timetable lecture error:', error);
    sendError(res, error);
  }
});

// ============================================
// DELETE /api/timetable/:id
// Delete a lecture (admin only).
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid timetable id' });

    const { data, error } = await supabase
      .from('timetable')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Lecture not found' });
    res.json({ ok: true, id });
  } catch (error) {
    console.error('Delete timetable lecture error:', error);
    sendError(res, error);
  }
});

// ============================================
// Error handling
// ============================================
router.use((err, req, res, next) => {
  if (!err) return next();
  console.error(`${req.method} ${req.originalUrl} error:`, err);
  sendError(res, err);
});

export default router;
