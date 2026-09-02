import { Router } from 'express';
import { supabase } from '../lib/db.js';
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

    const [{ data: department }, { data: enrollments }, { data: attendance }, { data: marks }] =
      await Promise.all([
        supabase
          .from('departments')
          .select('*')
          .eq('id', student.department_id)
          .maybeSingle(),
        supabase
          .from('enrollments')
          .select('*, semesters(*), sections(*)')
          .eq('student_id', student.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('attendance')
          .select('*, attendance_sessions(*, subjects(*), teachers(*))')
          .eq('student_id', student.id),
        supabase
          .from('marks')
          .select('*, assessments(*, subjects(*))')
          .eq('student_id', student.id)
          .order('entered_at', { ascending: false })
          .limit(100),
      ]);

    const activeEnrollment = enrollments?.[0] || null;

    // Timetable for the student's current section
    let timetable = [];
    const sectionId = activeEnrollment?.section_id;
    if (sectionId) {
      const { data: tt, error: ttError } = await supabase
        .from('timetable')
        .select('*, subjects(*), teachers(*), rooms(*)')
        .eq('section_id', sectionId)
        .order('day_of_week')
        .order('start_time');
      if (!ttError) timetable = tt || [];
    }

    // Notifications (latest + unread count)
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    const { count: allUnread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    // Relevant announcements (all + role + department code)
    const { data: announcements } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(30);

    const relevantAnnouncements = (announcements || []).filter((a) => {
      const targets = a.target_audience || [];
      return (
        targets.includes('all') ||
        targets.includes('student') ||
        (department?.code && targets.includes('department_' + department.code)) ||
        (student.current_semester && targets.includes('semester_' + student.current_semester))
      );
    });

    // Upcoming events
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(6);

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
      events: events || [],
      notifications: notifications || [],
      unreadNotifications: allUnread ?? 0,
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
      .select('*, attendance_sessions(*, subjects(*), teachers(*))')
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
      .select('*, assessments(*, subjects(*), semesters(*))')
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
      .select('*, semesters(*), sections(*)')
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
      .select('*, subjects(*), teachers(*), rooms(*)')
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

    const { data: department } = await supabase
      .from('departments')
      .select('*')
      .eq('id', student.department_id)
      .maybeSingle();

    res.json({ profile: req.profile, student, department });
  } catch (error) {
    console.error('Get student me error:', error);
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
// ============================================

function summarizeAttendance(records) {
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: records.length };
  for (const r of records) {
    const status = r.status || 'absent';
    if (summary[status] === undefined) summary[status] = 0;
    summary[status] += 1;
  }
  summary.presentCount = summary.present + summary.late;
  summary.percentage =
    summary.total > 0 ? Math.round((summary.presentCount / summary.total) * 1000) / 10 : 0;
  return summary;
}

function summarizeAttendanceBySubject(records) {
  const bySubject = new Map();
  for (const r of records) {
    const session = r.attendance_sessions;
    if (!session?.subject_id) continue;
    const subject = session.subjects || { id: session.subject_id, name: 'Unknown', code: '—' };
    const key = subject.id || subject.code;
    if (!bySubject.has(key)) {
      bySubject.set(key, { subject, present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }
    const bucket = bySubject.get(key);
    bucket.total += 1;
    const status = r.status || 'absent';
    if (bucket[status] === undefined) bucket[status] = 0;
    bucket[status] += 1;
  }
  return Array.from(bySubject.values()).map((b) => {
    b.presentCount = b.present + b.late;
    b.percentage = b.total > 0 ? Math.round((b.presentCount / b.total) * 1000) / 10 : 0;
    return b;
  });
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
    overallPercentage: maxSum > 0 ? Math.round((obtainedSum / maxSum) * 1000) / 10 : 0,
    bySubject: Array.from(bySubject.values()).map((b) => ({
      ...b,
      percentage: b.max > 0 ? Math.round((b.obtained / b.max) * 1000) / 10 : 0,
    })),
    byAssessment: Array.from(assessments.values()).map((a) => ({
      ...a,
      percentage: a.max > 0 ? Math.round((a.obtained / a.max) * 1000) / 10 : 0,
    })),
  };
}

export { resolveAuthorizedStudentId };

export default router;