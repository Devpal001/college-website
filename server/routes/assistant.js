import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { supabase } from '../lib/db.js';
import { classifyContent } from '../lib/ai.js';

const router = express.Router();

// ============================================
// AI ASSISTANT CONTROLLED TOOLS
// ============================================

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
  // First get student data
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', userId)
    .single();

  if (studentError) throw studentError;
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

  // Calculate attendance percentage
  const total = data.length;
  const present = data.filter(a => a.status === 'present').length;
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
  // First get student data
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', userId)
    .single();

  if (studentError) throw studentError;
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

  // Calculate average
  const total = data.length;
  const average = total > 0 
    ? Math.round(data.reduce((sum, m) => sum + (m.marks_obtained / m.marks_max * 100), 0) / total)
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
    // Get student's section
    const { data: student } = await supabase
      .from('students')
      .select('section_id')
      .eq('profile_id', userId)
      .single();

    if (!student) return { error: 'Student data not found' };

    const { data, error } = await supabase
      .from('timetable')
      .select('*, subjects(*), teachers(*), rooms(*)')
      .eq('section_id', student.section_id)
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;
    return { role: 'student', timetable: data };

  } else if (profile.role === 'teacher') {
    // Get teacher's assigned classes
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', userId)
      .single();

    if (!teacher) return { error: 'Teacher data not found' };

    const { data: assignments } = await supabase
      .from('teacher_subjects')
      .select('section_id, subjects(*), semesters(*)')
      .eq('teacher_id', teacher.id)
      .eq('is_active', true);

    // Get timetable for each section
    const sectionIds = assignments.map(a => a.section_id).filter(Boolean);
    
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

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString() || '9999-12-31')
    .order('published_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  // Filter by target audience
  const relevant = data.filter(announcement => {
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
    .order('published_at', { ascending: false });

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
    .single();

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
 * Main chat endpoint with controlled tool access
 */
router.post('/chat', authRequired, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.profile.id;
    const userRole = req.profile.role;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Classify the user's request to determine which tools to use
    const classification = await classifyContent(message);
    
    let toolResults = {};
    let response = '';
    let sources = [];

    // Execute tools based on classification and user role
    if (classification.includes('attendance') && userRole === 'student') {
      toolResults.attendance = await get_student_attendance(userId);
      response = `Your overall attendance is ${toolResults.attendance.percentage}%. You've attended ${toolResults.attendance.present} out of ${toolResults.attendance.total} classes.`;
    } 
    else if (classification.includes('marks') && userRole === 'student') {
      toolResults.marks = await get_student_marks(userId);
      response = `Your average marks are ${toolResults.marks.average}%. You have marks for ${toolResults.marks.total} assessments.`;
    }
    else if (classification.includes('timetable') || classification.includes('class') || classification.includes('schedule')) {
      toolResults.timetable = await get_timetable(userId);
      
      if (toolResults.timetable.timetable && toolResults.timetable.timetable.length > 0) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const todayClasses = toolResults.timetable.timetable.filter(t => t.day_of_week === today);
        
        if (todayClasses.length > 0) {
          const nextClass = todayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
          response = `Today you have ${todayClasses.length} classes. Your next class is ${nextClass.subjects?.name || 'Subject'} at ${nextClass.start_time} in ${nextClass.rooms?.room_number || 'Room ' + nextClass.room_id}.`;
        } else {
          response = "You don't have any classes scheduled for today.";
        }
      } else {
        response = "No timetable information available.";
      }
    }
    else if (classification.includes('announcement') || classification.includes('news') || classification.includes('update')) {
      toolResults.announcements = await get_announcements(userId);
      toolResults.news = await get_published_news(null, 3);
      
      const announcements = toolResults.announcements.slice(0, 3);
      const news = toolResults.news.slice(0, 2);
      
      let announcementText = announcements.length > 0 
        ? `Recent announcements: ${announcements.map(a => a.title).join(', ')}.`
        : 'No recent announcements.';
      
      let newsText = news.length > 0
        ? `Latest updates: ${news.map(n => n.title).join(', ')}.`
        : 'No recent updates.';
      
      response = `${announcementText} ${newsText}`;
      
      if (news.length > 0) {
        sources = news.map(n => ({
          title: n.title,
          source: n.news_sources?.name || 'Unknown',
          url: n.url,
          published: n.published_at
        }));
      }
    }
    else if (classification.includes('teacher') && userRole === 'teacher') {
      toolResults.classes = await get_teacher_classes(userId);
      response = `You are assigned to ${toolResults.classes.length} subjects across different sections.`;
    }
    else if (classification.includes('profile') || classification.includes('information')) {
      toolResults.profile = await get_user_profile(userId);
      response = `Hello ${toolResults.profile.full_name || 'User'}! You are logged in as a ${toolResults.profile.role}. How can I help you with your academic information?`;
    }
    else {
      // General fallback response
      response = "I can help you with information about your attendance, marks, timetable, announcements, and college updates. Try asking about any of these topics.";
    }

    // Log the AI interaction
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'assistant',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'completed',
      action: 'chat_response',
      confidence: 0.8,
      result: {
        user_message: message,
        response,
        tools_used: Object.keys(toolResults),
        classification
      },
      tool_calls: toolResults
    });

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
      error: error.message,
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

export default router;