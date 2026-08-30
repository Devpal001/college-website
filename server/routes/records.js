import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired, getTeacherForAuth } from '../middleware/auth.js';

const router = Router();

// All record-write endpoints require teacher authentication
router.use(authRequired);

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

// ============================================
// Notification trigger helper
// ============================================
async function triggerAttendanceNotification(studentId, attendancePercentage, subjectName) {
  try {
    // Get student profile
    const { data: student } = await supabase
      .from('students')
      .select('profile_id')
      .eq('id', studentId)
      .single();

    if (!student) return;

    // Check if attendance is below threshold (75%)
    if (attendancePercentage < 75) {
      // Check user notification preferences
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('attendance_alerts')
        .eq('user_id', student.profile_id)
        .single();

      const shouldNotify = preferences ? preferences.attendance_alerts : true;
      
      if (shouldNotify) {
        await supabase
          .from('notifications')
          .insert({
            user_id: student.profile_id,
            title: 'Low Attendance Alert',
            message: `Your attendance in ${subjectName} has fallen to ${attendancePercentage}%. Please attend classes regularly.`,
            type: 'attendance',
            priority: 'high',
            status: 'pending',
            data: { attendancePercentage, subjectName },
            created_at: new Date().toISOString()
          });
      }
    }
  } catch (error) {
    console.error('Error triggering attendance notification:', error);
    // Don't throw - notifications shouldn't block the main operation
  }
}

// ============================================
// Shared helper: verify teacher assignment
// ============================================
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

    if (!subjectId || !sectionId || !date) {
      return res.status(400).json({
        error: 'subjectId, sectionId and date are required',
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records must be a non-empty array' });
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

// Upsert attendance rows
    const upserts = await Promise.all(
      records.map(async (r) => {
        const status = ATTENDANCE_STATUSES.includes(r.status) ? r.status : 'present';
        const row = {
          session_id: sessionId,
          student_id: r.studentId,
          status,
          marked_by: teacher.id,
          marked_at: new Date().toISOString(),
          notes: r.notes ? String(r.notes).slice(0, 500) : null,
        };
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('session_id', sessionId)
          .eq('student_id', r.studentId)
          .maybeSingle();

        if (existing) {
          const { data, error } = await supabase
            .from('attendance')
            .update({ status, marked_by: teacher.id, marked_at: row.marked_at, notes: row.notes })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        }
        const { data, error } = await supabase.from('attendance').insert(row).select().single();
        if (error) throw error;
        return data;
      })
    );

    res.status(201).json({ sessionId, records: upserts });

    // Trigger attendance notifications for students with low attendance
    // This is done asynchronously after the response
    setImmediate(async () => {
      try {
        for (const record of records) {
          // Calculate attendance percentage for this student in this subject
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('*, attendance_sessions(subject_id)')
            .eq('student_id', record.studentId);

          if (attendanceData && attendanceData.length > 0) {
            const subjectAttendance = attendanceData.filter(a => 
              a.attendance_sessions?.subject_id === subjectId
            );
            
            if (subjectAttendance.length > 0) {
              const presentCount = subjectAttendance.filter(a => a.status === 'present').length;
              const percentage = (presentCount / subjectAttendance.length) * 100;
              
              // Get subject name
              const { data: subject } = await supabase
                .from('subjects')
                .select('name')
                .eq('id', subjectId)
                .single();

              if (subject) {
                await triggerAttendanceNotification(record.studentId, percentage, subject.name);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in attendance notification background task:', error);
      }
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: error.message });
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
      .select('*, attendance_sessions(*)')
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
    res.status(500).json({ error: error.message });
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

    if (!assessmentId) {
      return res.status(400).json({ error: 'assessmentId is required' });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records must be a non-empty array' });
    }

    const { data: assessment, error: assessError } = await supabase
      .from('assessments')
      .select('*')
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
        const { data: existing } = await supabase
          .from('marks')
          .select('id')
          .eq('assessment_id', assessmentId)
          .eq('student_id', r.studentId)
          .maybeSingle();

        if (existing) {
          const { data, error } = await supabase
            .from('marks')
            .update({ marks_obtained: obtained, remarks: row.remarks, entered_by: teacher.id })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        }
        const { data, error } = await supabase.from('marks').insert(row).select().single();
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

        // Filter by notification preferences and send notifications
        for (const student of students) {
          const { data: preferences } = await supabase
            .from('notification_preferences')
            .select('exam_updates')
            .eq('user_id', student.profile_id)
            .single();

          const shouldNotify = preferences ? preferences.exam_updates : true;
          
          if (shouldNotify) {
            await supabase
              .from('notifications')
              .insert({
                user_id: student.profile_id,
                title: 'Marks Published',
                message: `Your marks for ${assessment.title} (${subject.name}) have been published.`,
                type: 'exam',
                priority: 'normal',
                status: 'pending',
                data: { assessmentId: assessment.id, assessmentTitle: assessment.title, subjectName: subject.name },
                created_at: new Date().toISOString()
              });
          }
        }
      } catch (error) {
        console.error('Error in marks notification background task:', error);
      }
    });
  } catch (error) {
    console.error('Enter marks error:', error);
    res.status(500).json({ error: error.message });
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
    const { marksObtained, remarks } = req.body || {};

    const { data: record, error: fetchError } = await supabase
      .from('marks')
      .select('*, assessments(*)')
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
    res.status(500).json({ error: error.message });
  }
});

export default router;