import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { percentage, summarizeAttendance } from '../lib/academics.js';
import {
  authRequired,
  getStudentForAuth,
} from '../middleware/auth.js';

import { sendError } from '../lib/httpError.js';

const router = Router();

// All student endpoints require authentication
router.use(authRequired);

// ============================================
// Helpers
// ============================================

/**
 * Resolve the student id the request is allowed to view.
 * - Students: only themselves
 * - Teachers: only enrolled students in their assigned sections
 * - Admin: anyone (by student id)
 */
async function resolveAuthorizedStudentId(req, res, requestedStudentId) {
  const profileRole = req.profile.role;

  if (profileRole === 'admin' || profileRole === 'super_admin') {
    return requestedStudentId;
  }

  if (profileRole === 'student') {
    const student = await getStudentForAuth(req, res);
    if (!student) return null;
    if (requestedStudentId && requestedStudentId !== student.id) {
      res.status(403).json({ error: 'You can only access your own academic data' });
      return null;
    }
    return student.id;
  }

  if (profileRole === 'teacher') {
    if (!requestedStudentId) {
      res.status(400).json({ error: 'studentId is required' });
      return null;
    }
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', req.user.id)
      .single();
    if (!teacher) {
      res.status(403).json({ error: 'Teacher profile not found' });
      return null;
    }
    const { data: teacherSubjects } = await supabase
      .from('teacher_subjects')
      .select('section_id')
      .eq('teacher_id', teacher.id)
      .eq('is_active', true);
    const sectionIds = (teacherSubjects || [])
      .map((t) => t.section_id)
      .filter(Boolean);
    if (sectionIds.length === 0) {
      res.status(403).json({ error: 'You are not authorized to view this student' });
      return null;
    }
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', requestedStudentId)
      .eq('status', 'active')
      .in('section_id', sectionIds)
      .maybeSingle();
    if (!enrollment) {
      res.status(403).json({ error: 'You are not authorized to view this student' });
      return null;
    }
    return requestedStudentId;
  }

  res.status(403).json({ error: 'Insufficient permissions' });
  return null;
}

// ============================================
// GET /api/students/me/dashboard
// Aggregated dashboard data for the student.
// ============================================
router.get('/me/dashboard', async (req, res) => {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access the student dashboard' });
    }

    const student = await getStudentForAuth(req, res);
    if (!student) return;

    // Two round trips after the identity lookup (was six): everything that
    // depends only on `student` / `req.user.id` runs in one parallel wave;
    // only the timetable has to wait, because it needs the section id that
    // wave 1 discovers. These reads are the dashboard's core payload, so a
    // failed query must never be reported as "no records yet". An empty array
    // and a database error are indistinguishable downstream (0/0 attendance,
    // "No marks recorded yet"), which is exactly how a broken read turns into
    // a silent, convincing "the teacher never submitted anything" report. Core
    // failures surface as a retryable 500 with a stable code (same
    // discrimination as getStudentForAuth); the decorative sections
    // (department, timetable, announcements) stay soft.
    const [
      { data: department, error: departmentError },
      { data: enrollments, error: enrollmentsError },
      { data: attendance, error: attendanceError },
      { data: marks, error: marksError },
      { count: unreadCount } = { count: null },
      { data: announcementRows } = { data: [] },
      { data: eventRows } = { data: [] },
    ] = await Promise.all([
      // department_id is NULL for accounts provisioned without a department, and
      // `.eq('id', null)` fails with 22P02 rather than returning nothing — skip it.
      student.department_id
        ? supabase.from('departments').select('id, name, code').eq('id', student.department_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('enrollments')
        .select('id, student_id, section_id, semester_id, status, created_at, semesters(id, name, semester_number), sections(id, name)')
        .eq('student_id', student.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('attendance')
        .select('id, status, marked_at, attendance_sessions(id, date, subject_id, subjects(id, name, code))')
        .eq('student_id', student.id),
      supabase
        .from('marks')
        .select('id, marks_obtained, marks_max, entered_at, assessments(id, title, type, max_marks, subjects(id, name, code))')
        .eq('student_id', student.id)
        .order('entered_at', { ascending: false })
        .limit(100),
      // Unread badge (the notification *list* is fetched by NotificationBell,
      // not by this endpoint's consumer — see §24 request audit).
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('read', false),
      // Relevant announcements (all + role + department code)
      supabase
        .from('announcements')
        .select('id, title, category, target_audience, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(30),
      // Upcoming events
      supabase
        .from('events')
        .select('id, title, event_date, event_time')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(6),
    ]);

    for (const [table, queryError] of [
      ['enrollments', enrollmentsError],
      ['attendance', attendanceError],
      ['marks', marksError],
    ]) {
      if (!queryError) continue;
      console.error(
        `[students] dashboard ${table} query failed for students.id=${student.id} (${req.method} ${req.originalUrl}): ${queryError.code || 'unknown'} ${queryError.message}`
      );
      return res.status(500).json({
        error: 'Unable to load your academic records right now. Please try again in a moment.',
        code: 'STUDENT_RECORDS_UNAVAILABLE',
      });
    }
    if (departmentError) {
      console.warn(
        `[students] dashboard department lookup failed for students.id=${student.id}: ${departmentError.message}`
      );
    }

    const activeEnrollment = enrollments?.[0] || null;

    // Wave 2 (dependent): the timetable needs the section id resolved above.
    // Timetable for the student's current section. The grid only renders
    // day/time + subject/teacher/room names, so project exactly those.
    let timetable = [];
    const sectionId = activeEnrollment?.section_id;
    if (sectionId) {
      const { data: tt, error: ttError } = await supabase
        .from('timetable')
        .select('id, day_of_week, start_time, end_time, subjects(id, name, code), teachers(id, employee_id, profiles(full_name)), rooms(id, room_number), semesters(id, name)')
        .eq('section_id', sectionId)
        .order('day_of_week')
        .order('start_time');
      if (!ttError) timetable = tt || [];
    }

    // Announcements/events/unread count were fetched in wave 1 above; only the
    // relevance filter (which needs `department`) runs here.
    const relevantAnnouncements = (announcementRows || []).filter((a) => {
      const targets = a.target_audience || [];
      return (
        targets.includes('all') ||
        targets.includes('student') ||
        (department?.code && targets.includes('department_' + department.code)) ||
        (student.current_semester && targets.includes('semester_' + student.current_semester))
      );
    });

    res.json({
      profile: req.profile,
      student,
      department,
      enrollment: activeEnrollment,
      semester: activeEnrollment?.semesters || null,
      section: activeEnrollment?.sections || null,
      attendance: attendance || [],
      attendanceSummary: summarizeAttendance(attendance || []),
      attendanceBySubject: summarizeAttendanceBySubject(attendance || []),
      marks: marks || [],
      marksSummary: summarizeMarks(marks || []),
      timetable,
      announcements: relevantAnnouncements,
      events: eventRows || [],
      unreadNotifications: unreadCount ?? 0,
    });
  } catch (error) {
    console.error('Get student dashboard error:', error);
    sendError(res, error);
  }
});

// ============================================
// GET /api/students/me/attendance?semesterId=
// ============================================
router.get('/me/attendance', async (req, res) => {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access their attendance' });
    }

    const student = await getStudentForAuth(req, res);
    if (!student) return;

    const { semesterId } = req.query;

    let query = supabase
      .from('attendance')
      .select('id, status, marked_at, attendance_sessions(id, date, subject_id, subjects(id, name, code))')
      .eq('student_id', student.id)
      .order('marked_at', { ascending: false });

    if (semesterId) {
      query = query.eq('attendance_sessions.semester_id', semesterId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      attendance: data || [],
      attendanceSummary: summarizeAttendance(data || []),
      attendanceBySubject: summarizeAttendanceBySubject(data || []),
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    sendError(res, error);
  }
});

// ============================================
// GET /api/students/me/marks?semesterId=
// ============================================
router.get('/me/marks', async (req, res) => {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access their marks' });
    }

    const student = await getStudentForAuth(req, res);
    if (!student) return;

    const { semesterId } = req.query;

    let query = supabase
      .from('marks')
      .select('id, marks_obtained, marks_max, entered_at, assessments(id, title, type, max_marks, subjects(id, name, code))')
      .eq('student_id', student.id)
      .order('entered_at', { ascending: false });

    if (semesterId) {
      query = query.eq('assessments.semester_id', semesterId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      marks: data || [],
      marksSummary: summarizeMarks(data || []),
    });
  } catch (error) {
    console.error('Get student marks error:', error);
    sendError(res, error);
  }
});

// ============================================
// GET /api/students/me/timetable
// ============================================
router.get('/me/timetable', async (req, res) => {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access their timetable' });
    }

    const student = await getStudentForAuth(req, res);
    if (!student) return;

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, section_id, semester_id, status, created_at, semesters(id, name, semester_number), sections(id, name)')
      .eq('student_id', student.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const enrollment = enrollments?.[0];
    if (!enrollment?.section_id) {
      return res.json({ timetable: [], enrollment: null, semester: null, section: null });
    }

    const { data, error } = await supabase
      .from('timetable')
      .select('id, day_of_week, start_time, end_time, subjects(id, name, code), teachers(id, employee_id, profiles(full_name)), rooms(id, room_number), semesters(id, name)')
      .eq('section_id', enrollment.section_id)
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;

    res.json({
      timetable: data || [],
      enrollment,
      semester: enrollment.semesters || null,
      section: enrollment.sections || null,
    });
  } catch (error) {
    console.error('Get student timetable error:', error);
    sendError(res, error);
  }
});

// ============================================
// GET /api/students/me
// ============================================
router.get('/me', async (req, res) => {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access this endpoint' });
    }

    const student = await getStudentForAuth(req, res);
    if (!student) return;

    const { data: department } = student.department_id
      ? await supabase
        .from('departments')
        .select('id, name, code')
        .eq('id', student.department_id)
        .maybeSingle()
      : { data: null };

    res.json({ profile: req.profile, student, department });
  } catch (error) {
    console.error('Get student me error:', error);
    sendError(res, error);
  }
});
// ============================================
// PUT /api/students/me/profile
// Update authenticated student's editable profile fields.
// ============================================
router.put('/me/profile', async (req, res) => {
  try {
    if (req.profile.role !== 'student') {
      return res.status(403).json({ error: 'Only students can update their profile' });
    }

    const student = await getStudentForAuth(req, res);
    if (!student) return;

    const updates = req.body || {};
    const allowed = ['address', 'city', 'state', 'emergency_contact_name', 'emergency_contact_phone'];
    const clean = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        clean[key] = updates[key] === '' ? null : String(updates[key]).trim();
      }
    }

    const { data, error } = await supabase
      .from('students')
      .update(clean)
      .eq('id', student.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Student profile not found' });

    res.json(data);
  } catch (error) {
    console.error('Update student profile error:', error);
    sendError(res, error);
  }
});

// ============================================
// Lookup by enrollment number
// Only the student themself, or teacher/admin.
// ============================================
router.get('/enrollment/:enrollmentNumber', async (req, res) => {
  try {
    const { enrollmentNumber } = req.params;

    const { data, error } = await supabase
      .from('students')
      .select('*, profiles(*)')
      .eq('enrollment_number', enrollmentNumber)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Student not found' });
    }

    let ownStudent = null;
    if (req.profile.role === 'student') {
      ownStudent = await getStudentForAuth(req, res);
      if (!ownStudent) return;
    }

    const isSelf = ownStudent && ownStudent.id === data.id;
    const isTeacherOrAdmin = ['teacher', 'admin', 'super_admin'].includes(req.profile.role);

    if (!isSelf && !isTeacherOrAdmin) {
      return res.status(403).json({ error: 'You are not authorized to view this student' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get student error:', error);
    sendError(res, error);
  }
});

// ============================================
// Legacy: GET /api/students/:studentId/attendance
// ============================================
router.get('/:studentId/attendance', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subjectId, semesterId } = req.query;

    const authorizedStudentId = await resolveAuthorizedStudentId(req, res, studentId);
    if (!authorizedStudentId) return;

    let query = supabase
      .from('attendance')
      .select('*, attendance_sessions(*), subjects(*)')
      .eq('student_id', authorizedStudentId);

    if (subjectId) query = query.eq('attendance_sessions.subject_id', subjectId);
    if (semesterId) query = query.eq('attendance_sessions.semester_id', semesterId);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get attendance error:', error);
    sendError(res, error);
  }
});
// ============================================
// Legacy: GET /api/students/:studentId/marks
// ============================================
router.get('/:studentId/marks', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semesterId } = req.query;

    const authorizedStudentId = await resolveAuthorizedStudentId(req, res, studentId);
    if (!authorizedStudentId) return;

    let query = supabase
      .from('marks')
      .select('*, assessments(*), subjects(*)')
      .eq('student_id', authorizedStudentId);

    if (semesterId) query = query.eq('assessments.semester_id', semesterId);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get marks error:', error);
    sendError(res, error);
  }
});

// ============================================
// Summary helpers (shared)
// --------------------------------------------
// Attendance/marks arithmetic lives in server/lib/academics.js so the
// dashboard, the AI assistant and any future report agree on the rules.
// ============================================

function summarizeAttendanceBySubject(records) {
  const bySubject = new Map();
  for (const record of records) {
    const session = record.attendance_sessions;
    if (!session?.subject_id) continue;
    const subject = session.subjects || { id: session.subject_id, name: 'Unknown', code: '—' };
    const key = subject.id || subject.code;
    if (!bySubject.has(key)) bySubject.set(key, { subject, records: [] });
    bySubject.get(key).records.push(record);
  }
  return Array.from(bySubject.values()).map(({ subject, records: subjectRecords }) => ({
    subject,
    ...summarizeAttendance(subjectRecords),
  }));
}
function summarizeMarks(records) {
  const bySubject = new Map();
  const assessments = new Map();
  let obtainedSum = 0;
  let maxSum = 0;

  for (const m of records) {
    const assessment = m.assessments;
    const subject = assessment?.subjects || { id: null, name: assessment?.title || 'Unknown', code: '—' };
    const key = subject.id || subject.name || 'unknown';
    if (!bySubject.has(key)) {
      bySubject.set(key, { subject, obtained: 0, max: 0, count: 0 });
    }
    const bucket = bySubject.get(key);
    bucket.obtained += Number(m.marks_obtained) || 0;
    bucket.max += Number(m.marks_max) || 0;
    bucket.count += 1;

    obtainedSum += Number(m.marks_obtained) || 0;
    maxSum += Number(m.marks_max) || 0;

    if (assessment) {
      if (!assessments.has(assessment.id)) {
        assessments.set(assessment.id, { assessment, obtained: 0, max: 0 });
      }
      const a = assessments.get(assessment.id);
      a.obtained += Number(m.marks_obtained) || 0;
      a.max += Number(m.marks_max) || 0;
    }
  }

  return {
    obtainedSum,
    maxSum,
    overallPercentage: percentage(obtainedSum, maxSum, { decimals: 1 }),
    bySubject: Array.from(bySubject.values()).map((b) => ({
      ...b,
      percentage: percentage(b.obtained, b.max, { decimals: 1 }),
    })),
    byAssessment: Array.from(assessments.values()).map((a) => ({
      ...a,
      percentage: percentage(a.obtained, a.max, { decimals: 1 }),
    })),
  };
}

export { resolveAuthorizedStudentId };

export default router;