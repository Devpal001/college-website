import { Router } from 'express';
import { supabase } from '../lib/db.js';
import {
  authRequired,
  getTeacherForAuth,
  requireRole,
} from '../middleware/auth.js';

import { sendError } from '../lib/httpError.js';

const router = Router();
const meRouter = Router();

// ============================================
// Configuration
// ============================================

const ASSESSMENT_TYPES = Object.freeze([
  'assignment',
  'quiz',
  'midterm',
  'practical',
  'final',
  'other',
]);

const ASSESSMENT_TYPES_SET = new Set(ASSESSMENT_TYPES);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_MARKS_LIMIT = 1000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ============================================
// Middleware
// ============================================

// All teacher endpoints require authentication, and all /me endpoints
// additionally require the 'teacher' role. Checking the role once here
// removes the duplicated `if (req.profile.role !== 'teacher')` blocks.
router.use(authRequired);
meRouter.use(requireRole('teacher'));

// ============================================
// Helpers
// ============================================

/** Wrap an async Express handler so rejected promises reach the error middleware. */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Verify that a teacher is assigned to teach a subject (optionally in a section).
 */
async function isTeacherAssigned(teacherId, subjectId, sectionId = null) {
  let query = supabase
    .from('teacher_subjects')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)
    .eq('is_active', true);

  if (sectionId) query = query.eq('section_id', sectionId);

  const { data, error } = await query.maybeSingle();
  return Boolean(!error && data);
}

/**
 * Parse and clamp a query-string `limit` to a safe positive integer.
 */
function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

/**
 * Fetch a teacher's active subject assignments, optionally filtered by semester.
 * Shared by the `/me/subjects` and legacy `/:teacherId/subjects` endpoints.
 */
function teacherSubjectsQuery(teacherId, semesterId) {
  let query = supabase
    .from('teacher_subjects')
    .select('*, subjects(*), semesters(*), sections(*)')
    .eq('teacher_id', teacherId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (semesterId) query = query.eq('semester_id', semesterId);
  return query;
}

// ============================================
// GET /api/teachers/me/dashboard
// ============================================
meRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const [
    { data: subjects },
    { data: schedule },
    { data: notifications },
    { count: unreadNotifications },
  ] = await Promise.all([
    supabase
      .from('teacher_subjects')
      .select('*, subjects(*), semesters(*), sections(*)')
      .eq('teacher_id', teacher.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('timetable')
      .select('*, subjects(*), sections(*), rooms(*), semesters(*)')
      .eq('teacher_id', teacher.id)
      .order('day_of_week')
      .order('start_time'),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false),
  ]);

  res.json({
    profile: req.profile,
    teacher,
    subjects: subjects || [],
    schedule: schedule || [],
    notifications: notifications || [],
    unreadNotifications: unreadNotifications ?? 0,
  });
}));

// ============================================
// GET /api/teachers/me
// ============================================
meRouter.get('/', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const { data: department, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', teacher.department_id)
    .maybeSingle();

  if (error) throw error;

  res.json({ profile: req.profile, teacher, department });
}));

// ============================================
// GET /api/teachers/me/subjects?semesterId=
// ============================================
meRouter.get('/subjects', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const { data, error } = await teacherSubjectsQuery(teacher.id, req.query.semesterId);

  if (error) throw error;

  res.json(data || []);
}));

// ============================================
// GET /api/teachers/me/schedule
// Teacher's timetable across assigned classes.
// ============================================
meRouter.get('/schedule', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const { data, error } = await supabase
    .from('timetable')
    .select('*, subjects(*), sections(*, semesters(*)), rooms(*)')
    .eq('teacher_id', teacher.id)
    .order('day_of_week')
    .order('start_time');

  if (error) throw error;

  res.json(data || []);
}));

// ============================================
// GET /api/teachers/me/sessions?subjectId=&sectionId=&limit=
// Attendance sessions for the teacher's classes.
// ============================================
meRouter.get('/sessions', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const { subjectId, sectionId, limit } = req.query;

  let query = supabase
    .from('attendance_sessions')
    .select('*, subjects(*), sections(*, semesters(*))')
    .eq('teacher_id', teacher.id)
    .order('date', { ascending: false });

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (sectionId) query = query.eq('section_id', sectionId);

  const { data, error } = await query.limit(parseLimit(limit));

  if (error) throw error;

  res.json(data || []);
}));

// ============================================
// GET /api/teachers/me/assessments?semesterId=
// Assessments for the teacher's subjects.
// ============================================
meRouter.get('/assessments', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const { data: assignments, error: assignmentsError } = await supabase
    .from('teacher_subjects')
    .select('subject_id')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true);

  if (assignmentsError) throw assignmentsError;

  const subjectIds = [
    ...new Set((assignments || []).map((a) => a.subject_id).filter(Boolean)),
  ];
  if (subjectIds.length === 0) {
    return res.json([]);
  }

  let query = supabase
    .from('assessments')
    .select('*, subjects(*), semesters(*)')
    .in('subject_id', subjectIds)
    .order('created_at', { ascending: false });

  if (req.query.semesterId) query = query.eq('semester_id', req.query.semesterId);

  const { data, error } = await query.limit(MAX_LIMIT);

  if (error) throw error;

  res.json(data || []);
}));

// ============================================
// POST /api/teachers/me/assessments
// Create an assessment for one of the teacher's subjects.
// ============================================
meRouter.post('/assessments', asyncHandler(async (req, res) => {
  const teacher = await getTeacherForAuth(req, res);
  if (!teacher) return;

  const {
    subjectId,
    semesterId,
    title,
    type,
    maxMarks,
    weightage,
    dateScheduled,
  } = req.body || {};

  if (!subjectId || !semesterId || !title || !type) {
    return res.status(400).json({ error: 'subjectId, semesterId, title and type are required' });
  }

  const trimmedTitle = String(title).trim();
  if (!trimmedTitle) {
    return res.status(400).json({ error: 'title must not be empty' });
  }

  if (!ASSESSMENT_TYPES_SET.has(type)) {
    return res.status(400).json({
      error: `type must be one of: ${ASSESSMENT_TYPES.join(', ')}`,
    });
  }

  const parsedMax = Number(maxMarks);
  if (!Number.isFinite(parsedMax) || parsedMax <= 0 || parsedMax > MAX_MARKS_LIMIT) {
    return res.status(400).json({
      error: `maxMarks must be a positive number up to ${MAX_MARKS_LIMIT}`,
    });
  }

  const assigned = await isTeacherAssigned(teacher.id, subjectId);
  if (!assigned) {
    return res.status(403).json({ error: 'You are not assigned to this subject' });
  }

  const payload = {
    subject_id: subjectId,
    semester_id: semesterId,
    title: trimmedTitle,
    type,
    max_marks: parsedMax,
    created_by: teacher.id,
  };

  if (weightage !== undefined && weightage !== null && weightage !== '') {
    const parsedWeight = Number(weightage);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
      return res.status(400).json({ error: 'weightage must be a number between 0 and 100' });
    }
    payload.weightage = parsedWeight;
  }

  if (dateScheduled) {
    const isValidDate = DATE_REGEX.test(dateScheduled) && !Number.isNaN(Date.parse(dateScheduled));
    if (!isValidDate) {
      return res.status(400).json({ error: 'dateScheduled must be a valid date in YYYY-MM-DD format' });
    }
    payload.date_scheduled = dateScheduled;
  }

  const { data, error } = await supabase
    .from('assessments')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  res.status(201).json(data);
}));

// ============================================
// Mount point: /api/teachers/me/*
// (Registered before the legacy catch-all below so that
// /me/subjects hits the dedicated route, not /:teacherId/subjects.)
// ============================================
router.use('/me', meRouter);

// ============================================
// Legacy: GET /api/teachers/:teacherId/subjects
// Teachers can only view their own; admins any.
// ============================================
router.get('/:teacherId/subjects', asyncHandler(async (req, res) => {
  const { teacherId } = req.params;

  if (req.profile.role === 'teacher') {
    const teacher = await getTeacherForAuth(req, res);
    if (!teacher) return;
    if (teacher.id !== teacherId) {
      return res.status(403).json({ error: 'You can only view your own subjects' });
    }
  } else if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { data, error } = await teacherSubjectsQuery(teacherId, req.query.semesterId);

  if (error) throw error;

  res.json(data || []);
}));

// ============================================
// Error handling
// ============================================
router.use((err, req, res, next) => {
  if (!err) return next();
  console.error(`${req.method} ${req.originalUrl} error:`, err);
  sendError(res, err);
});

export default router;