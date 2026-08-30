import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import academicsRouter from './routes/academics.js';
import profileRouter from './routes/profile.js';
import recordsRouter from './routes/records.js';
import studentsRouter from './routes/students.js';
import teachersRouter from './routes/teachers.js';
import newsRouter from './routes/news.js';
import agentRouter from './routes/agent.js';
import { startNewsScheduler } from './lib/scheduler.js';

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

// Get the actual directory of this file.
// This makes the .env path work regardless of
// which folder you run the npm command from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your .env is in the ROOT college-website folder.
// server/index.js is inside the server folder.
const envPath = path.resolve(__dirname, '../.env');

const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn(`⚠️ Could not load .env from: ${envPath}`);
  console.warn('Make sure the .env file exists in the college-website root folder.');
}

// ============================================
// VALIDATE ENVIRONMENT VARIABLES
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;

// Support both the newer secret-key variable
// and the older service-role variable.
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is missing.');
  console.error(`Expected .env file at: ${envPath}`);
  console.error('Add this to your .env file:');
  console.error('SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Supabase server secret key is missing.');
  console.error(`Expected .env file at: ${envPath}`);
  console.error(
    'Add SUPABASE_SERVICE_ROLE_KEY=sb_secret_... to your .env file.'
  );
  process.exit(1);
}

// ============================================
// INITIALIZE APP
// ============================================

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// MODULAR API ROUTERS — Phase 3 + Phase 4
// The news router is mounted FIRST because its public
// feed/source-listing endpoints must stay reachable without
// authentication; all later routers apply a global
// authRequired guard at mount time. The news router guards
// its own /admin and write endpoints internally.
// Mounted before the legacy inline handlers below so the
// authenticated, service-role API takes precedence for
// attendance, marks, timetable, student/teacher dashboards,
// profile, and academic reference data (and closes the
// unauthenticated legacy /verify and /pending-review holes).
// ============================================
app.use('/api/news', newsRouter);
app.use('/api', academicsRouter);
app.use('/api/profile', profileRouter);
app.use('/api', recordsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/agent', agentRouter);
console.log('✅ Modular API routers mounted (news, agent, academics, profile, records, students, teachers)');

// ============================================
// SUPABASE
// ============================================

// IMPORTANT:
// This key is server-side only.
// NEVER expose it in frontend code.
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

console.log('✅ Supabase client initialized successfully');

// ============================================
// HEALTH CHECK
// ============================================

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

    if (!data) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Get profile error:', error);

    res.status(500).json({
      error: error.message
    });
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

    if (!data) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Update profile error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================
// STUDENT ENDPOINTS
// ============================================

// Get student by enrollment number
app.get(
  '/api/students/enrollment/:enrollmentNumber',
  async (req, res) => {
    try {
      const { enrollmentNumber } = req.params;

      const { data, error } = await supabase
        .from('students')
        .select('*, profiles(*)')
        .eq('enrollment_number', enrollmentNumber)
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          error: 'Student not found'
        });
      }

      res.json(data);
    } catch (error) {
      console.error('Get student error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Get student attendance
app.get(
  '/api/students/:studentId/attendance',
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { subjectId, semesterId } = req.query;

      let query = supabase
        .from('attendance')
        .select(
          '*, attendance_sessions(*), subjects(*)'
        )
        .eq('student_id', studentId);

      if (subjectId) {
        query = query.eq(
          'attendance_sessions.subject_id',
          subjectId
        );
      }

      if (semesterId) {
        query = query.eq(
          'attendance_sessions.semester_id',
          semesterId
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Get attendance error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Get student marks
app.get(
  '/api/students/:studentId/marks',
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { semesterId } = req.query;

      let query = supabase
        .from('marks')
        .select(
          '*, assessments(*), subjects(*)'
        )
        .eq('student_id', studentId);

      if (semesterId) {
        query = query.eq(
          'assessments.semester_id',
          semesterId
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Get marks error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// ============================================
// TEACHER ENDPOINTS
// ============================================

// Get teacher's assigned subjects
app.get(
  '/api/teachers/:teacherId/subjects',
  async (req, res) => {
    try {
      const { teacherId } = req.params;
      const { semesterId } = req.query;

      let query = supabase
        .from('teacher_subjects')
        .select(
          '*, subjects(*), semesters(*), sections(*)'
        )
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (semesterId) {
        query = query.eq(
          'semester_id',
          semesterId
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Get teacher subjects error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Mark attendance
app.post('/api/attendance', async (req, res) => {
  try {
    const { sessionId, attendance } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required'
      });
    }

    if (!Array.isArray(attendance)) {
      return res.status(400).json({
        error: 'attendance must be an array'
      });
    }

    // Verify the attendance session
    const {
      data: session,
      error: sessionError
    } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Prepare attendance records
    const attendanceRecords = attendance.map(record => ({
      session_id: sessionId,
      student_id: record.studentId,
      status: record.status,
      marked_by: session.teacher_id,
      marked_at: new Date().toISOString()
    }));

    if (attendanceRecords.length === 0) {
      return res.status(400).json({
        error: 'No attendance records provided'
      });
    }

    const {
      data,
      error
    } = await supabase
      .from('attendance')
      .insert(attendanceRecords)
      .select();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Mark attendance error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// Enter marks
app.post('/api/marks', async (req, res) => {
  try {
    const { assessmentId, marks } = req.body;

    if (!assessmentId) {
      return res.status(400).json({
        error: 'assessmentId is required'
      });
    }

    if (!Array.isArray(marks)) {
      return res.status(400).json({
        error: 'marks must be an array'
      });
    }

    // Verify assessment
    const {
      data: assessment,
      error: assessmentError
    } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();

    if (assessmentError) throw assessmentError;

    if (!assessment) {
      return res.status(404).json({
        error: 'Assessment not found'
      });
    }

    const maxMarks = assessment.max_marks;

    const marksRecords = marks.map(record => ({
      assessment_id: assessmentId,
      student_id: record.studentId,
      marks_obtained: record.marksObtained,
      marks_max: maxMarks,
      entered_by: assessment.created_by,
      entered_at: new Date().toISOString()
    }));

    if (marksRecords.length === 0) {
      return res.status(400).json({
        error: 'No marks records provided'
      });
    }

    const {
      data,
      error
    } = await supabase
      .from('marks')
      .insert(marksRecords)
      .select();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Enter marks error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================
// ACADEMIC DATA ENDPOINTS
// ============================================

// Get timetable for a section
app.get(
  '/api/timetable/:sectionId',
  async (req, res) => {
    try {
      const { sectionId } = req.params;
      const { dayOfWeek } = req.query;

      let query = supabase
        .from('timetable')
        .select(
          '*, subjects(*), teachers(*), rooms(*)'
        )
        .eq('section_id', sectionId);

      if (dayOfWeek) {
        query = query.eq(
          'day_of_week',
          dayOfWeek
        );
      }

      const {
        data,
        error
      } = await query.order('start_time');

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Get timetable error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Get departments
app.get('/api/departments', async (req, res) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get departments error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================
// ANNOUNCEMENTS & EVENTS
// ============================================

// Get announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const {
      category,
      targetAudience
    } = req.query;

    let query = supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true);

    if (category) {
      query = query.eq(
        'category',
        category
      );
    }

    // target_audience is a PostgreSQL TEXT[] column.
    // contains() should receive an array.
    if (targetAudience) {
      query = query.contains(
        'target_audience',
        [targetAudience]
      );
    }

    const {
      data,
      error
    } = await query
      .order('published_at', {
        ascending: false
      })
      .limit(20);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get announcements error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// Get events
app.get('/api/events', async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('events')
      .select('*')
      .gte(
        'event_date',
        new Date()
          .toISOString()
          .split('T')[0]
      );

    if (category) {
      query = query.eq(
        'category',
        category
      );
    }

    const {
      data,
      error
    } = await query.order(
      'event_date',
      {
        ascending: true
      }
    );

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get events error:', error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

// Get user notifications
app.get(
  '/api/notifications/:userId',
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { unreadOnly } = req.query;

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId);

      if (unreadOnly === 'true') {
        query = query.eq(
          'read',
          false
        );
      }

      const {
        data,
        error
      } = await query
        .order('created_at', {
          ascending: false
        })
        .limit(50);

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error(
        'Get notifications error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Mark notification as read
app.put(
  '/api/notifications/:id/read',
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        data,
        error
      } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }

      res.json(data);
    } catch (error) {
      console.error(
        'Mark notification read error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Get notification preferences
app.get(
  '/api/notifications/preferences/:userId',
  async (req, res) => {
    try {
      const { userId } = req.params;

      const {
        data,
        error
      } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error(
        'Get notification preferences error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Update notification preferences
app.put(
  '/api/notifications/preferences/:userId',
  async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = req.body;

      const {
        data,
        error
      } = await supabase
        .from('notification_preferences')
        .update(preferences)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error(
        'Update notification preferences error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// ============================================
// NEWS & AI ENDPOINTS
// ============================================

// Get published news
app.get('/api/news', async (req, res) => {
  try {
    const {
      category,
      limit
    } = req.query;

    let query = supabase
      .from('news_items')
      .select(
        '*, news_sources(*)'
      )
      .eq(
        'is_published',
        true
      );

    if (category) {
      query = query.eq(
        'category',
        category
      );
    }

    const parsedLimit = limit
      ? parseInt(limit, 10)
      : 20;

    const safeLimit =
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 20;

    const {
      data,
      error
    } = await query
      .order(
        'published_at',
        {
          ascending: false
        }
      )
      .limit(safeLimit);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error(
      'Get news error:',
      error
    );

    res.status(500).json({
      error: error.message
    });
  }
});

// Get news sources
app.get(
  '/api/news-sources',
  async (req, res) => {
    try {
      const {
        data,
        error
      } = await supabase
        .from('news_sources')
        .select('*')
        .order('priority');

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error(
        'Get news sources error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Get pending AI news for review
app.get(
  '/api/news/pending-review',
  async (req, res) => {
    try {
      const {
        data,
        error
      } = await supabase
        .from('news_items')
        .select(
          '*, news_sources(*)'
        )
        .eq(
          'verification_status',
          'pending'
        )
        .order(
          'retrieved_at',
          {
            ascending: false
          }
        );

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error(
        'Get pending news error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Approve or reject news item
app.put(
  '/api/news/:id/verify',
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        status,
        publishedBy
      } = req.body;

      if (
        status !== 'verified' &&
        status !== 'rejected'
      ) {
        return res.status(400).json({
          error:
            "status must be either 'verified' or 'rejected'"
        });
      }

      const updateData = {
        verification_status: status,
        updated_at:
          new Date().toISOString()
      };

      if (status === 'verified') {
        updateData.is_published = true;
        updateData.published_by = publishedBy;
        updateData.published_at =
          new Date().toISOString();
      }

      if (status === 'rejected') {
        updateData.is_published = false;
      }

      const {
        data,
        error
      } = await supabase
        .from('news_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          error: 'News item not found'
        });
      }

      res.json(data);
    } catch (error) {
      console.error(
        'Verify news error:',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

// ============================================
// ERROR HANDLING
// ============================================

// Global Express error handler
app.use(
  (err, req, res, next) => {
    console.error(
      'Unhandled server error:',
      err
    );

    res.status(500).json({
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong'
    });
  }
);

// 404 handler
app.use(
  (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl
    });
  }
);

// ============================================
// START SERVER
// ============================================

app.listen(
  PORT,
  () => {
    console.log('');
    console.log(
      '🚀 College Digital Platform API running'
    );
    console.log(
      `📡 Health check: http://localhost:${PORT}/health`
    );
    console.log(
      `🔗 API Base URL: http://localhost:${PORT}/api`
    );
    console.log(
      `🔐 Supabase: Connected`
    );
    startNewsScheduler();
    console.log('');
  }
);