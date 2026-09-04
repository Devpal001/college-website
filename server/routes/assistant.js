import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { supabase } from '../lib/db.js';
import { classifyContent } from '../lib/ai.js';

import { sendError } from '../lib/httpError.js';

const router = express.Router();

// ============================================
// M-2 (Phase 7): per-user rate limit for chat.
// In-memory, mirrors the auth limiter pattern in routes/auth.js
// (fine for a single instance, not a cluster).
// ============================================
const CHAT_WINDOW_MS = 60_000;
const CHAT_MAX_PER_WINDOW = 10;
const chatAttempts = new Map(); // profile id -> number[] (timestamps)

function isChatRateLimited(userId) {
  const now = Date.now();
  const attempts = (chatAttempts.get(userId) || []).filter((t) => now - t < CHAT_WINDOW_MS);
  if (attempts.length >= CHAT_MAX_PER_WINDOW) {
    chatAttempts.set(userId, attempts);
    return true;
  }
  attempts.push(now);
  chatAttempts.set(userId, attempts);
  return false;
}

// ============================================
// AI ASSISTANT CONTROLLED TOOLS
// ============================================
// Every tool is scoped to the authenticated user (req.profile)
// and returns either a data object/array or a graceful
// { error: '...' } result — tools must never crash the chat.

/**
 * Helper: get the student row for a profile id.
 * Uses maybeSingle() so a missing student record comes back
 * as null (handled gracefully) instead of a thrown error.
 */
async function getStudentByProfile(userId) {
  const { data: student, error } = await supabase
    .from('students')
    .select('id, current_section')
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) throw error;
  return student;
}

/**
 * Helper: resolve the student's active section id.
 * The section lives on the ACTIVE enrollments row (same
 * convention as server/routes/students.js). Falls back to
 * students.current_section when it stores a section UUID.
 */
async function getStudentSectionId(student) {
  if (!student) return null;

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select('section_id')
    .eq('student_id', student.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (enrollment?.section_id) return enrollment.section_id;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (student.current_section && UUID_RE.test(student.current_section)) {
    return student.current_section;
  }

  return null;
}

/**
 * Tool: get_user_profile
 * Get current user's profile information
 */
async function get_user_profile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tool: get_student_attendance
 * Get student's attendance overview
 */
async function get_student_attendance(userId, subjectId = null) {
  const student = await getStudentByProfile(userId);
  if (!student) return { error: 'Student data not found' };

  let query = supabase
    .from('attendance')
    .select('*, attendance_sessions(*, subjects(*))')
    .eq('student_id', student.id);

  if (subjectId) {
    query = query.eq('attendance_sessions.subject_id', subjectId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Calculate attendance percentage.
  // 'late' still counts as having attended the class.
  const total = data.length;
  const present = data.filter(a => a.status === 'present' || a.status === 'late').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    total,
    present,
    absent: total - present,
    percentage,
    details: data
  };
}

/**
 * Tool: get_student_marks
 * Get student's marks overview
 */
async function get_student_marks(userId, semesterId = null) {
  const student = await getStudentByProfile(userId);
  if (!student) return { error: 'Student data not found' };

  let query = supabase
    .from('marks')
    .select('*, assessments(*, subjects(*))')
    .eq('student_id', student.id);

  if (semesterId) {
    query = query.eq('assessments.semester_id', semesterId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Calculate average — guard against missing/zero marks_max
  // so the response never contains NaN or Infinity.
  const valid = data.filter(
    m => Number.isFinite(Number(m.marks_obtained)) &&
         Number.isFinite(Number(m.marks_max)) &&
         Number(m.marks_max) > 0
  );
  const total = valid.length;
  const average = total > 0
    ? Math.round(valid.reduce((sum, m) => sum + (Number(m.marks_obtained) / Number(m.marks_max)) * 100, 0) / total)
    : 0;

  return {
    total,
    average,
    details: data
  };
}

/**
 * Tool: get_timetable
 * Get user's timetable
 */
async function get_timetable(userId) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  if (profile.role === 'student') {
    const student = await getStudentByProfile(userId);
    if (!student) return { error: 'Student data not found' };

    const sectionId = await getStudentSectionId(student);
    if (!sectionId) {
      return {
        role: 'student',
        timetable: [],
        info: 'no active section enrollment found'
      };
    }

    const { data, error } = await supabase
      .from('timetable')
      .select('*, subjects(*), teachers(*), rooms(*)')
      .eq('section_id', sectionId)
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;
    return { role: 'student', timetable: data };

  } else if (profile.role === 'teacher') {
    // Get teacher's assigned classes
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (teacherError) throw teacherError;
    if (!teacher) return { error: 'Teacher data not found' };

    const { data: assignments, error: assignmentsError } = await supabase
      .from('teacher_subjects')
      .select('section_id, subjects(*), semesters(*)')
      .eq('teacher_id', teacher.id)
      .eq('is_active', true);

    if (assignmentsError) throw assignmentsError;

    // Get timetable for each section
    const sectionIds = (assignments || []).map(a => a.section_id).filter(Boolean);

    if (sectionIds.length === 0) {
      return { role: 'teacher', timetable: [] };
    }

    const { data, error } = await supabase
      .from('timetable')
      .select('*, subjects(*), teachers(*), rooms(*)')
      .in('section_id', sectionIds)
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;
    return { role: 'teacher', timetable: data };

  } else {
    return { error: 'Timetable not available for your role' };
  }
}

/**
 * Tool: get_announcements
 * Get relevant announcements
 */
async function get_announcements(userId) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  // Keep announcements that never expire (expires_at IS NULL)
  // as well as those that have not expired yet.
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order('published_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  // Filter by target audience
  const relevant = (data || []).filter(announcement => {
    const targets = announcement.target_audience || [];
    return targets.includes('all') ||
           targets.includes(profile.role) ||
           targets.includes(profile.id);
  });

  return relevant;
}

/**
 * Tool: get_published_news
 * Get published college news
 */
async function get_published_news(category = null, limit = 5) {
  let query = supabase
    .from('news_items')
    .select('*, news_sources(*)')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false });

  if (category) {
    query = query.eq('category', category);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Tool: get_teacher_classes
 * Get teacher's assigned classes
 */
async function get_teacher_classes(userId) {
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();

  if (teacherError) throw teacherError;
  if (!teacher) return { error: 'Teacher data not found' };

  const { data, error } = await supabase
    .from('teacher_subjects')
    .select('*, subjects(*), semesters(*), sections(*)')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true);

  if (error) throw error;
  return data;
}

// ============================================
// AI ASSISTANT ENDPOINTS
// ============================================

/**
 * POST /api/assistant/chat
 * Main chat endpoint with controlled tool access.
 *
 * Request:  { message: string, conversationHistory?: [{role, content}] }
 * Response: { response: string, sources: [], tools_used: [], classification }
 *
 * Never returns a hard error — any tool failure degrades into a
 * friendly message so the UI never has to show a generic error.
 */
router.post('/chat', authRequired, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.profile.id;
    const userRole = req.profile.role;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // M-2 (Phase 7): cap message size (cost/abuse control) and rate limit
    // per user. Safe validation errors with stable codes.
    if (message.length > 4000) {
      return res.status(400).json({
        error: 'Message is too long (maximum 4000 characters)',
        code: 'MESSAGE_TOO_LONG',
      });
    }
    if (isChatRateLimited(userId)) {
      return res.status(429).json({
        error: 'Too many chat requests. Please try again in a minute.',
        code: 'RATE_LIMITED',
      });
    }

    // Classify the user's request to determine which tools to use.
    // classifyContent never throws; it returns a space-separated
    // string of matched intents (e.g. 'attendance marks') or 'general'.
    const classification = await classifyContent(message);

    let toolResults = {};
    let response = '';
    let sources = [];

    const isStudent = userRole === 'student';
    const isTeacher = userRole === 'teacher';

    // Execute tools based on classification and user role
    if (classification.includes('attendance')) {
      if (!isStudent) {
        response = 'Attendance records are only available for student accounts.';
      } else {
        const attendance = await get_student_attendance(userId);
        toolResults.attendance = attendance;

        if (attendance?.error) {
          response = attendance.error;
        } else if (!attendance || attendance.total === 0) {
          response = "I couldn't find any attendance records for you yet. They will appear here as soon as your teachers start recording attendance.";
        } else {
          response = `Your overall attendance is ${attendance.percentage}%. You've attended ${attendance.present} out of ${attendance.total} classes.`;
        }
      }
    }
    else if (classification.includes('marks')) {
      if (!isStudent) {
        response = 'Marks are only available for student accounts.';
      } else {
        const marks = await get_student_marks(userId);
        toolResults.marks = marks;

        if (marks?.error) {
          response = marks.error;
        } else if (!marks || marks.total === 0) {
          response = "I couldn't find any recorded marks for you yet. They will appear here as soon as your teachers publish assessment results.";
        } else {
          response = `Your average score is ${marks.average}% across ${marks.total} assessed item${marks.total === 1 ? '' : 's'}.`;

          const recent = (marks.details || [])
            .filter(m => m.assessments)
            .slice(-3)
            .map(m => {
              const max = Number(m.marks_max) || 0;
              const pct = max > 0 ? Math.round((Number(m.marks_obtained) / max) * 100) : '—';
              return `${m.assessments.title} (${pct}%)`;
            });
          if (recent.length > 0) {
            response += ` Recent results: ${recent.join(', ')}.`;
          }
        }
      }
    }
    else if (classification.includes('timetable') || classification.includes('schedule') || classification.includes('class')) {
      const timetable = await get_timetable(userId);
      toolResults.timetable = timetable;

      if (timetable?.error) {
        response = timetable.error;
      } else if (!timetable || !Array.isArray(timetable.timetable) || timetable.timetable.length === 0) {
        response = timetable?.info
          ? `No timetable information available yet (${timetable.info}).`
          : 'No timetable information available.';
      } else {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const todayClasses = timetable.timetable.filter(t => t.day_of_week === today);

        if (todayClasses.length > 0) {
          const nextClass = todayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
          response = `Today you have ${todayClasses.length} class${todayClasses.length === 1 ? '' : 'es'}. Your next class is ${nextClass.subjects?.name || 'Subject'} at ${nextClass.start_time} in ${nextClass.rooms?.room_number || (nextClass.room_id ? 'Room ' + nextClass.room_id : 'your usual room')}.`;
        } else {
          response = "You don't have any classes scheduled for today.";
        }
      }
    }
    else if (classification.includes('announcement') || classification.includes('news') || classification.includes('update')) {
      const announcements = await get_announcements(userId);
      toolResults.announcements = announcements;
      toolResults.news = await get_published_news(null, 3);

      const recentAnnouncements = (Array.isArray(announcements) ? announcements : []).slice(0, 3);
      const news = (Array.isArray(toolResults.news) ? toolResults.news : []).slice(0, 2);

      const announcementText = recentAnnouncements.length > 0
        ? `Recent announcements: ${recentAnnouncements.map(a => a.title).join(', ')}.`
        : 'No recent announcements.';

      const newsText = news.length > 0
        ? `Latest updates: ${news.map(n => n.title).join(', ')}.`
        : 'No recent updates.';

      response = `${announcementText} ${newsText}`;

      if (news.length > 0) {
        // news_items uses published_date (agent entries) or published_at
        // (manual admin entries); fall back through both to retrieved_at
        // so the UI never renders "Invalid Date".
        sources = news.map(n => ({
          title: n.title,
          source: n.news_sources?.name || 'Unknown',
          url: n.url,
          published: n.published_at || n.published_date || n.retrieved_at
        }));
      }
    }
    else if (isTeacher && (classification.includes('teacher') || classification.includes('assigned'))) {
      const classes = await get_teacher_classes(userId);
      toolResults.classes = classes;

      if (classes?.error) {
        response = classes.error;
      } else {
        const count = Array.isArray(classes) ? classes.length : 0;
        response = count > 0
          ? `You are assigned to ${count} subject${count === 1 ? '' : 's'} across your sections.`
          : 'You have no active subject assignments right now.';
      }
    }
    else if (classification.includes('profile') || classification.includes('information')) {
      const profile = await get_user_profile(userId);
      toolResults.profile = profile;

      response = profile
        ? `Hello ${profile.full_name || 'there'}! You are logged in as a ${profile.role}. How can I help you with your academic information?`
        : 'I could not find your profile information.';
    }
    else {
      // General fallback response
      response = "I can help you with information about your attendance, marks, timetable, announcements, and college updates. Try asking about any of these topics.";
    }

    // Log the AI interaction — a logging failure must never
    // destroy a perfectly good answer.
    // H-1 (Phase 7): NEVER persist the raw user message, the AI response,
    // or tool payloads here - they contain the user's academic data
    // (marks/attendance/profile). Only minimal, non-sensitive metadata
    // is kept for analytics.
    try {
      await supabase.from('ai_agent_runs').insert({
        agent_type: 'assistant',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'completed',
        action: 'chat_response',
        confidence: 0.8,
        result: {
          classification,
          tools_used: Object.keys(toolResults)
        }
      });
    } catch (logError) {
      console.warn('Assistant chat logging failed (non-fatal):', logError?.message || logError);
    }

    res.json({
      response,
      sources,
      tools_used: Object.keys(toolResults),
      classification
    });

  } catch (error) {
    console.error('AI assistant error:', error);

    // Fallback response if something goes wrong
    res.json({
      response: "I'm having trouble accessing your information right now. Please try again later or contact support if the issue persists.",
      error: null,
      sources: [],
      tools_used: []
    });
  }
});

/**
 * GET /api/assistant/tools
 * Get available tools for the current user
 */
router.get('/tools', authRequired, async (req, res) => {
  try {
    const userRole = req.profile.role;

    const availableTools = [
      {
        name: 'get_user_profile',
        description: 'Get your profile information',
        available: true
      },
      {
        name: 'get_announcements',
        description: 'Get college announcements',
        available: true
      },
      {
        name: 'get_published_news',
        description: 'Get published college news',
        available: true
      }
    ];

    if (userRole === 'student') {
      availableTools.push(
        { name: 'get_student_attendance', description: 'Get your attendance overview', available: true },
        { name: 'get_student_marks', description: 'Get your marks overview', available: true },
        { name: 'get_timetable', description: 'Get your class timetable', available: true }
      );
    } else if (userRole === 'teacher') {
      availableTools.push(
        { name: 'get_teacher_classes', description: 'Get your assigned classes', available: true },
        { name: 'get_timetable', description: 'Get your teaching schedule', available: true }
      );
    }

    res.json({ tools: availableTools });
  } catch (error) {
    console.error('Error getting available tools:', error);
    sendError(res, error);
  }
});

/**
 * GET /api/assistant/suggestions
 * Get suggested questions for the user
 */
router.get('/suggestions', authRequired, async (req, res) => {
  try {
    const userRole = req.profile.role;

    let suggestions = [];

    if (userRole === 'student') {
      suggestions = [
        "What's my attendance percentage?",
        "Show my marks overview",
        "What classes do I have today?",
        "Any new announcements?",
        "What are the latest college updates?"
      ];
    } else if (userRole === 'teacher') {
      suggestions = [
        "What classes am I teaching today?",
        "Show my assigned subjects",
        "Any new announcements?",
        "What are the latest college updates?"
      ];
    } else {
      suggestions = [
        "What are the latest college updates?",
        "Any new announcements?",
        "Show system status"
      ];
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    sendError(res, error);
  }
});

export default router;