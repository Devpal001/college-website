import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired, getTeacherForAuth } from '../middleware/auth.js';

import { sendError } from '../lib/httpError.js';
import { isUuid, requireArray, requireUuid } from '../lib/validate.js';

const router = Router();

// All record-write endpoints require teacher authentication
router.use(authRequired);

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

// ============================================
// Notification trigger helpers (batched — §24)
// ============================================
// The low-attendance path used to run up to 3 queries PER student (profile
// lookup, preferences lookup, insert) inside a background loop — as many as
// 1500 queries for a 500-student submission, plus a subject lookup repeated
// once per student. These helpers do the same work in at most three queries
// and keep the original semantics:
//   - student with no `students` row      -> skipped
//   - no `notification_preferences` row   -> notify (default on)
//   - preferences row present             -> notify only when the flag is truthy
// Notifications stay best-effort: errors are logged, never thrown, so the
// main request (already answered) can never be affected.
async function sendLowAttendanceAlerts(low, subjectName) {
  try {
    if (low.length === 0) return;

    const { data: students, error } = await supabase
      .from('students')
      .select('id, profile_id')
      .in('id', low.map((l) => l.studentId));
    if (error || !students) return;

    const profileByStudent = new Map(students.map((s) => [s.id, s.profile_id]));
    const targets = low.filter((l) => profileByStudent.has(l.studentId));
    if (targets.length === 0) return;

    const profileIds = targets.map((l) => profileByStudent.get(l.studentId));
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('user_id, attendance_alerts')
      .in('user_id', profileIds);
    const prefByUser = new Map(
      (preferences || []).map((p) => [p.user_id, p.attendance_alerts])
    );

    const rows = targets
      .filter((l) => {
        const pid = profileByStudent.get(l.studentId);
        return prefByUser.has(pid) ? Boolean(prefByUser.get(pid)) : true;
      })
      .map((l) => ({
        user_id: profileByStudent.get(l.studentId),
        title: 'Low Attendance Alert',
        message: `Your attendance in ${subjectName} has fallen to ${l.percentage}%. Please attend classes regularly.`,
        type: 'attendance',
        priority: 'high',
        status: 'pending',
        data: { attendancePercentage: l.percentage, subjectName },
        created_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      await supabase.from('notifications').insert(rows);
    }
  } catch (error) {
    console.error('Error triggering attendance notification:', error);
    // Don't throw - notifications shouldn't block the main operation
  }
}

// ============================================
// Shared helper: verify teacher assignment
// ============================================
export async function isTeacherAssigned(teacherId, subjectId, sectionId = null) {
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

// ============================================
// POST /api/attendance
// Mark (or update) attendance for a class session.
// Body: { subjectId, sectionId, date, records: [{ studentId, status }] }
// ============================================
router.post('/attendance', async (req, res) => {
  try {
    if (req.profile.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can mark attendance' });
    }

    const teacher = await getTeacherForAuth(req, res);
    if (!teacher) return;

    const { subjectId, sectionId, date, records } = req.body || {};

    // ---- Server-side validation (never trust req.body) ----
    requireUuid(subjectId, 'subjectId');
    requireUuid(sectionId, 'sectionId');
    requireArray(records, 'records', { max: 500 });
    for (const r of records) {
      if (!r || typeof r.studentId !== 'string' || !isUuid(r.studentId)) {
        return res.status(400).json({ error: 'each record must have a valid studentId UUID' });
      }
      if (!ATTENDANCE_STATUSES.includes(r.status)) {
        return res
          .status(400)
          .json({ error: `each record status must be one of: ${ATTENDANCE_STATUSES.join(', ')}` });
      }
    }

    const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
    if (!isDateValid) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    const assigned = await isTeacherAssigned(teacher.id, subjectId, sectionId);
    if (!assigned) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject in this section' });
    }

    const studentIds = records.map((r) => r.studentId);
    const { data: enrolled } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('section_id', sectionId)
      .eq('status', 'active')
      .in('student_id', studentIds);

    const enrolledSet = new Set((enrolled || []).map((e) => e.student_id));
    const unknown = studentIds.filter((id) => !enrolledSet.has(id));
    if (unknown.length > 0) {
      return res.status(400).json({ error: 'Some students are not enrolled in this section' });
    }

    // Find or create attendance session
    let sessionId = null;
    const { data: existingSession } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('section_id', sectionId)
      .eq('subject_id', subjectId)
      .eq('date', date)
      .maybeSingle();

    if (existingSession) {
      sessionId = existingSession.id;
    } else {
      const { data: newSession, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          section_id: sectionId,
          subject_id: subjectId,
          teacher_id: teacher.id,
          date,
          status: 'completed',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      sessionId = newSession.id;
    }

    const rows = records.map((r) => ({
      session_id: sessionId,
      student_id: r.studentId,
      status: r.status,
      marked_by: teacher.id,
      marked_at: new Date().toISOString(),
      notes: r.notes ? String(r.notes).slice(0, 500) : null,
    }));

    const { data: upserts, error: upsertError } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'session_id,student_id' })
      .select();

    if (upsertError) throw upsertError;

    res.status(201).json({ sessionId, records: upserts });

    // Trigger attendance notifications for students with low attendance.
    // Runs asynchronously after the response (non-blocking, as before) but is
    // batched (§24): 1 subject lookup + 1 attendance read covering every
    // student + at most 3 notification queries = 5 queries total instead of
    // up to 5 per submitted student.
    setImmediate(async () => {
      try {
        const studentIds = [...new Set(records.map((r) => r.studentId))];

        // The subject is identical for every student — look it up once.
        const { data: subject } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', subjectId)
          .single();
        if (!subject) return;

        // One read for the whole submission: each student's attendance rows
        // that belong to THIS subject's sessions (!inner keeps the join to
        // matching sessions, so only rows that count are returned).
        const { data: attendanceRows, error: attendanceError } = await supabase
          .from('attendance')
          .select('student_id, status, attendance_sessions!inner(subject_id)')
          .in('student_id', studentIds)
          .eq('attendance_sessions.subject_id', subjectId);
        if (attendanceError) {
          console.error(
            'attendance batch for notifications failed:',
            attendanceError.message
          );
          return;
        }

        // Same arithmetic as the per-student loop this replaces: present /
        // total within this subject, and only students that have at least one
        // row here are eligible.
        const byStudent = new Map();
        for (const row of attendanceRows || []) {
          const list = byStudent.get(row.student_id) || [];
          list.push(row);
          byStudent.set(row.student_id, list);
        }

        const low = [];
        for (const studentId of studentIds) {
          const rows = byStudent.get(studentId);
          if (!rows || rows.length === 0) continue;
          const presentCount = rows.filter((a) => a.status === 'present').length;
          const percentage = (presentCount / rows.length) * 100;
          if (percentage < 75) low.push({ studentId, percentage });
        }

        await sendLowAttendanceAlerts(low, subject.name);
      } catch (error) {
        console.error('Error in attendance notification background task:', error);
      }
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    sendError(res, error);
  }
});

// ============================================
// GET /api/attendance?sessionId=
// List attendance records for a session (teacher/admin only).
// ============================================
router.get('/attendance', async (req, res) => {
  try {
    if (req.profile.role !== 'teacher' && req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*, students(*, profiles(*))')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get attendance error:', error);
    sendError(res, error);
  }
});

// ============================================
// PUT /api/attendance/:id
// Update a single attendance record (own sessions only).
// ============================================
router.put('/attendance/:id', async (req, res) => {
  try {
    if (req.profile.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can update attendance' });
    }

    const teacher = await getTeacherForAuth(req, res);
    if (!teacher) return;

    const { id } = req.params;
    const { status, notes } = req.body || {};

    if (!ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be one of present, absent, late, excused' });
    }

    const { data: record, error: fetchError } = await supabase
      .from('attendance')
      .select('id, status, notes, attendance_sessions(teacher_id)')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (record.attendance_sessions?.teacher_id !== teacher.id) {
      return res.status(403).json({ error: 'You can only update attendance you marked' });
    }

    const { data, error } = await supabase
      .from('attendance')
      .update({
        status,
        notes: notes !== undefined ? String(notes).slice(0, 500) : record.notes,
        marked_by: teacher.id,
        marked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Update attendance error:', error);
    sendError(res, error);
  }
});

// ============================================
// POST /api/marks
// Enter marks for an assessment the teacher teaches.
// Body: { assessmentId, records: [{ studentId, marksObtained, remarks }] }
// ============================================
router.post('/marks', async (req, res) => {
  try {
    if (req.profile.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can enter marks' });
    }

    const teacher = await getTeacherForAuth(req, res);
    if (!teacher) return;

    const { assessmentId, records } = req.body || {};

    requireUuid(assessmentId, 'assessmentId');
    requireArray(records, 'records', { max: 500 });

    const { data: assessment, error: assessError } = await supabase
      .from('assessments')
      .select('id, title, subject_id, max_marks')
      .eq('id', assessmentId)
      .single();

    if (assessError || !assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assigned = await isTeacherAssigned(teacher.id, assessment.subject_id);
    if (!assigned) {
      return res.status(403).json({ error: 'You are not assigned to this assessment subject' });
    }

    const maxMarks = Number(assessment.max_marks);
    const studentIds = records.map((r) => r.studentId);

    // Validate students exist
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .in('id', studentIds);
    const validStudentIds = new Set((students || []).map((s) => s.id));
    const unknown = studentIds.filter((id) => !validStudentIds.has(id));
    if (unknown.length > 0) {
      return res.status(400).json({ error: 'Some students could not be found' });
    }

    // Validate marks against maximum
    for (const r of records) {
      const obtained = Number(r.marksObtained);
      if (!Number.isFinite(obtained) || obtained < 0 || obtained > maxMarks) {
        return res.status(400).json({
          error: `marksObtained for student ${r.studentId} must be between 0 and ${maxMarks}`,
        });
      }
    }

    const upserts = await Promise.all(
      records.map(async (r) => {
        const obtained = Number(r.marksObtained);
        const row = {
          assessment_id: assessmentId,
          student_id: r.studentId,
          marks_obtained: obtained,
          marks_max: maxMarks,
          remarks: r.remarks ? String(r.remarks).slice(0, 500) : null,
          entered_by: teacher.id,
          entered_at: new Date().toISOString(),
        };
        // Single round trip per student: the marks table's
        // UNIQUE(assessment_id, student_id) makes the row idempotent, so one
        // upsert replaces the old maybeSingle + update-or-insert pair (which
        // needed 2 round trips per student).
        const { data, error } = await supabase
          .from('marks')
          .upsert(row, { onConflict: 'assessment_id,student_id' })
          .select()
          .single();
        if (error) throw error;
        return data;
      })
    );

    res.status(201).json({ assessmentId, records: upserts });

    // Trigger marks notifications for students
    // This is done asynchronously after the response
    setImmediate(async () => {
      try {
        // Get subject and assessment info
        const { data: subject } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', assessment.subject_id)
          .single();

        if (!subject) return;

        // Get student profiles for all students who received marks
        const studentIds = records.map(r => r.studentId);
        const { data: students } = await supabase
          .from('students')
          .select('id, profile_id')
          .in('id', studentIds);

        if (!students) return;

        // Filter by notification preferences and send notifications.
        // One batched preferences read + one bulk insert instead of up to two
        // queries per student (§24 N+1 fix); same defaults and row shape.
        const { data: preferences } = await supabase
          .from('notification_preferences')
          .select('user_id, exam_updates')
          .in('user_id', students.map((s) => s.profile_id));
        const prefByUser = new Map(
          (preferences || []).map((p) => [p.user_id, p.exam_updates])
        );

        const rows = students
          .filter((student) =>
            prefByUser.has(student.profile_id)
              ? Boolean(prefByUser.get(student.profile_id))
              : true
          )
          .map((student) => ({
            user_id: student.profile_id,
            title: 'Marks Published',
            message: `Your marks for ${assessment.title} (${subject.name}) have been published.`,
            type: 'exam',
            priority: 'normal',
            status: 'pending',
            data: { assessmentId: assessment.id, assessmentTitle: assessment.title, subjectName: subject.name },
            created_at: new Date().toISOString()
          }));

        if (rows.length > 0) {
          await supabase.from('notifications').insert(rows);
        }
      } catch (error) {
        console.error('Error in marks notification background task:', error);
      }
    });
  } catch (error) {
    console.error('Enter marks error:', error);
    sendError(res, error);
  }
});

// ============================================
// PUT /api/marks/:id
// Update a marks record on an assessment the teacher owns.
// ============================================
router.put('/marks/:id', async (req, res) => {
  try {
    if (req.profile.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can update marks' });
    }

    const teacher = await getTeacherForAuth(req, res);
    if (!teacher) return;

    const { id } = req.params;
    requireUuid(id, 'id');

    const { marksObtained, remarks } = req.body || {};

    const { data: record, error: fetchError } = await supabase
      .from('marks')
      .select('id, marks_obtained, marks_max, remarks, assessments(subject_id)')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      return res.status(404).json({ error: 'Marks record not found' });
    }

    const maxMarks = Number(record.marks_max);
    const obtained = marksObtained !== undefined ? Number(marksObtained) : Number(record.marks_obtained);

    if (!Number.isFinite(obtained) || obtained < 0 || obtained > maxMarks) {
      return res.status(400).json({ error: `marksObtained must be between 0 and ${maxMarks}` });
    }

    const assigned = await isTeacherAssigned(teacher.id, record.assessments?.subject_id);
    if (!assigned) {
      return res.status(403).json({ error: 'You are not assigned to this assessment subject' });
    }

    const { data, error } = await supabase
      .from('marks')
      .update({
        marks_obtained: obtained,
        remarks: remarks !== undefined ? String(remarks).slice(0, 500) : record.remarks,
        entered_by: teacher.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Update marks error:', error);
    sendError(res, error);
  }
});

// ============================================
// GET /api/marks?assessmentId=
// List marks for an assessment (teacher/admin only).
// ============================================
router.get('/marks', async (req, res) => {
  try {
    if (req.profile.role !== 'teacher' && req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { assessmentId } = req.query;
    if (!assessmentId) {
      return res.status(400).json({ error: 'assessmentId is required' });
    }

    const { data, error } = await supabase
      .from('marks')
      .select('*, students(*, profiles(*))')
      .eq('assessment_id', assessmentId)
      .order('entered_at', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get marks error:', error);
    sendError(res, error);
  }
});

export default router;