import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// ============================================
// GET /api/departments  (public reference data)
// ============================================
router.get('/departments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Everything below requires authentication
router.use(authRequired);

// ============================================
// GET /api/courses?departmentId=
// ============================================
router.get('/courses', async (req, res) => {
  try {
    const { departmentId } = req.query;

    let query = supabase
      .from('courses')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (departmentId) query = query.eq('department_id', departmentId);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/semesters?courseId=&activeOnly=
// ============================================
router.get('/semesters', async (req, res) => {
  try {
    const { courseId, activeOnly } = req.query;

    let query = supabase.from('semesters').select('*').order('semester_number');

    if (courseId) query = query.eq('course_id', courseId);
    if (activeOnly === 'true') query = query.eq('is_active', true);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get semesters error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ============================================
// GET /api/subjects?departmentId=
// ============================================
router.get('/subjects', async (req, res) => {
  try {
    const { departmentId } = req.query;

    let query = supabase.from('subjects').select('*').order('name');

    if (departmentId) query = query.eq('department_id', departmentId);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/rooms
// ============================================
router.get('/rooms', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('room_number');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/timetable/:sectionId?dayOfWeek=
// Students only for their own section; teachers only
// for sections they teach; admins any.
// ============================================
router.get('/timetable/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { dayOfWeek } = req.query;
    const role = req.profile.role;

    let authorized = role === 'admin' || role === 'super_admin';

    if (!authorized && role === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (student) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', student.id)
          .eq('section_id', sectionId)
          .eq('status', 'active')
          .maybeSingle();
        authorized = Boolean(enrollment);
      }
    }

    if (!authorized && role === 'teacher') {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (teacher) {
        const { data: assignment } = await supabase
          .from('teacher_subjects')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('section_id', sectionId)
          .eq('is_active', true)
          .maybeSingle();
        authorized = Boolean(assignment);
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'You are not authorized to view this timetable' });
    }

    let query = supabase
      .from('timetable')
      .select('*, subjects(*), teachers(*), rooms(*)')
      .eq('section_id', sectionId);

    if (dayOfWeek) query = query.eq('day_of_week', dayOfWeek);

    const { data, error } = await query.order('day_of_week').order('start_time');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/sections/:sectionId/students
// Enrolled students in a section (teacher/admin only).
// ============================================
router.get('/sections/:sectionId/students', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const role = req.profile.role;

    let authorized = role === 'admin' || role === 'super_admin';

    if (!authorized && role === 'teacher') {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (teacher) {
        const { data: assignment } = await supabase
          .from('teacher_subjects')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('section_id', sectionId)
          .eq('is_active', true)
          .maybeSingle();
        authorized = Boolean(assignment);
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'You are not authorized to view this class list' });
    }

    const { data, error } = await supabase
      .from('enrollments')
      .select('*, students(*, profiles(*), departments(*))')
      .eq('section_id', sectionId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json((data || []).map((e) => e.students).filter(Boolean));
  } catch (error) {
    console.error('Get section students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/sections?semesterId=
// ============================================
router.get('/sections', async (req, res) => {
  try {
    const { semesterId } = req.query;

    let query = supabase
      .from('sections')
      .select('*, semesters(*, courses(*))')
      .order('name');

    if (semesterId) query = query.eq('semester_id', semesterId);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;