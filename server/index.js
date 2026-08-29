import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase with service role key for server operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'College Digital Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// PROFILE ENDPOINTS
// ============================================

// Get user profile
app.get('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Profile not found' });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Profile not found' });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STUDENT ENDPOINTS
// ============================================

// Get student by enrollment number
app.get('/api/students/enrollment/:enrollmentNumber', async (req, res) => {
  try {
    const { enrollmentNumber } = req.params;
    const { data, error } = await supabase
      .from('students')
      .select('*, profiles(*)')
      .eq('enrollment_number', enrollmentNumber)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Student not found' });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get student attendance
app.get('/api/students/:studentId/attendance', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subjectId, semesterId } = req.query;

    let query = supabase
      .from('attendance')
      .select('*, attendance_sessions(*), subjects(*)')
      .eq('student_id', studentId);

    if (subjectId) query = query.eq('attendance_sessions.subject_id', subjectId);
    if (semesterId) query = query.eq('attendance_sessions.semester_id', semesterId);

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get student marks
app.get('/api/students/:studentId/marks', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semesterId } = req.query;

    let query = supabase
      .from('marks')
      .select('*, assessments(*), subjects(*)')
      .eq('student_id', studentId);

    if (semesterId) {
      query = query.eq('assessments.semester_id', semesterId);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEACHER ENDPOINTS
// ============================================

// Get teacher's assigned subjects
app.get('/api/teachers/:teacherId/subjects', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { semesterId } = req.query;

    let query = supabase
      .from('teacher_subjects')
      .select('*, subjects(*), semesters(*), sections(*)')
      .eq('teacher_id', teacherId)
      .eq('is_active', true);

    if (semesterId) query = query.eq('semester_id', semesterId);

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark attendance
app.post('/api/attendance', async (req, res) => {
  try {
    const { sessionId, attendance } = req.body; // attendance: [{ studentId, status }, ...]

    // First verify the teacher is authorized for this session
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Mark attendance for each student
    const attendanceRecords = attendance.map(record => ({
      session_id: sessionId,
      student_id: record.studentId,
      status: record.status,
      marked_by: session.teacher_id,
      marked_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('attendance')
      .insert(attendanceRecords)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enter marks
app.post('/api/marks', async (req, res) => {
  try {
    const { assessmentId, marks } = req.body; // marks: [{ studentId, marksObtained }, ...]

    // Verify teacher is authorized for this assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();

    if (assessmentError) throw assessmentError;
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    // Get max marks from assessment
    const maxMarks = assessment.max_marks;

    // Insert marks for each student
    const marksRecords = marks.map(record => ({
      assessment_id: assessmentId,
      student_id: record.studentId,
      marks_obtained: record.marksObtained,
      marks_max: maxMarks,
      entered_by: assessment.created_by,
      entered_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('marks')
      .insert(marksRecords)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACADEMIC DATA ENDPOINTS
// ============================================

// Get timetable for a section
app.get('/api/timetable/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { dayOfWeek } = req.query;

    let query = supabase
      .from('timetable')
      .select('*, subjects(*), teachers(*), rooms(*)')
      .eq('section_id', sectionId);

    if (dayOfWeek) query = query.eq('day_of_week', dayOfWeek);

    const { data, error } = await query.order('start_time');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get departments
app.get('/api/departments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ANNOUNCEMENTS & EVENTS
// ============================================

// Get announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const { category, targetAudience } = req.query;

    let query = supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (targetAudience) query = query.contains('target_audience', targetAudience);

    const { data, error } = await query
      .order('published_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get events
app.get('/api/events', async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('events')
      .select('*')
      .gte('event_date', new Date().toISOString().split('T')[0]);

    if (category) query = query.eq('category', category);

    const { data, error } = await query
      .order('event_date', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

// Get user notifications
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (unreadOnly === 'true') query = query.eq('read', false);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Notification not found' });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notification preferences
app.get('/api/notifications/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update notification preferences
app.put('/api/notifications/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    const { data, error } = await supabase
      .from('notification_preferences')
      .update(preferences)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NEWS & AI ENDPOINTS
// ============================================

// Get published news
app.get('/api/news', async (req, res) => {
  try {
    const { category, limit } = req.query;

    let query = supabase
      .from('news_items')
      .select('*, news_sources(*)')
      .eq('is_published', true);

    if (category) query = query.eq('category', category);

    const { data, error } = await query
      .order('published_at', { ascending: false })
      .limit(limit ? parseInt(limit) : 20);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get news sources (admin only)
app.get('/api/news-sources', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('*')
      .order('priority');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending AI news for review (admin only)
app.get('/api/news/pending-review', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select('*, news_sources(*)')
      .eq('verification_status', 'pending')
      .order('retrieved_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve or reject news item (admin only)
app.put('/api/news/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, publishedBy } = req.body; // status: 'verified' | 'rejected'

    const updateData = {
      verification_status: status,
      updated_at: new Date().toISOString()
    };

    if (status === 'verified') {
      updateData.is_published = true;
      updateData.published_by = publishedBy;
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('news_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'News item not found' });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 College Digital Platform API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});