import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { supabase } from '../lib/db.js';

import { sendError } from '../lib/httpError.js';

const router = express.Router();

// UUID format check (shared by the trigger endpoints below).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// NOTIFICATION HELPERS
// ============================================

/**
 * Create notification for specific users
 */
async function createNotificationForUsers(userIds, notificationData) {
  const notifications = userIds.map(userId => ({
    user_id: userId,
    title: notificationData.title,
    message: notificationData.message,
    type: notificationData.type,
    priority: notificationData.priority || 'normal',
    status: 'pending',
    data: notificationData.data || null,
    created_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Create notification for target audience (from announcements)
 */
async function createNotificationForAudience(targetAudience, notificationData) {
  const userIds = [];

  for (const target of targetAudience) {
    if (target === 'all_students') {
      const { data: students } = await supabase
        .from('students')
        .select('profile_id');
      userIds.push(...students.map(s => s.profile_id));
    } else if (target === 'all_teachers') {
      const { data: teachers } = await supabase
        .from('teachers')
        .select('profile_id');
      userIds.push(...teachers.map(t => t.profile_id));
    } else if (target === 'student' || target === 'teacher' || target === 'admin') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', target)
        .eq('is_active', true);
      userIds.push(...profiles.map(p => p.id));
    }
  }

  // Remove duplicates
  const uniqueUserIds = [...new Set(userIds)];
  return await createNotificationForUsers(uniqueUserIds, notificationData);
}

/**
 * Check user notification preferences
 */
async function shouldSendNotification(userId, notificationType) {
  const { data: preferences, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !preferences) return true; // Default to send if no preferences

  // Check based on notification type
  switch (notificationType) {
    case 'announcement':
      return preferences.college_announcements;
    case 'exam':
    case 'holiday':
    case 'result':
      return preferences.exam_updates;
    case 'attendance':
      return preferences.attendance_alerts;
    case 'timetable':
      return preferences.timetable_changes;
    case 'event':
      return preferences.events;
    case 'placement':
      return preferences.placement_news;
    case 'scholarship':
      return preferences.scholarships;
    case 'ai_news':
      return preferences.ai_discoveries;
    default:
      return true;
  }
}

// ============================================
// USER NOTIFICATION ENDPOINTS
// ============================================

/**
 * GET /api/notifications/me
 * Get current user's notifications
 */
router.get('/me', authRequired, async (req, res) => {
  try {
    const userId = req.profile.id;
    const { unreadOnly, limit = 50 } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (unreadOnly === 'true') {
      query = query.eq('read', false);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    res.json({ data, count: data.length });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    sendError(res, error);
  }
});

/**
 * GET /api/notifications/me/unread-count
 * Get unread notification count
 */
router.get('/me/unread-count', authRequired, async (req, res) => {
  try {
    const userId = req.profile.id;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    sendError(res, error);
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.profile.id;

    // Verify ownership
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

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
    res.json(data);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    sendError(res, error);
  }
});

/**
 * PUT /api/notifications/me/read-all
 * Mark all notifications as read
 */
router.put('/me/read-all', authRequired, async (req, res) => {
  try {
    const userId = req.profile.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    res.json({ success: true, updated: data });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    sendError(res, error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.profile.id;

    // Verify ownership
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    sendError(res, error);
  }
});

// ============================================
// NOTIFICATION PREFERENCES ENDPOINTS
// ============================================

/**
 * GET /api/notifications/me/preferences
 * Get user notification preferences
 */
router.get('/me/preferences', authRequired, async (req, res) => {
  try {
    const userId = req.profile.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no preferences exist, create default preferences
      const { data: newPrefs, error: createError } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: userId,
          college_announcements: true,
          exam_updates: true,
          attendance_alerts: true,
          timetable_changes: true,
          events: true,
          placement_news: true,
          scholarships: true,
          ai_discoveries: true
        })
        .select()
        .single();

      if (createError) throw createError;
      return res.json(newPrefs);
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    sendError(res, error);
  }
});

/**
 * PUT /api/notifications/me/preferences
 * Update user notification preferences
 */
router.put('/me/preferences', authRequired, async (req, res) => {
  try {
    const userId = req.profile.id;
    const preferences = req.body || {};

    // Whitelist: only the known preference booleans may be updated.
    // Never spread the raw request body into the update (mass-assignment).
    const ALLOWED_PREFERENCES = [
      'college_announcements',
      'exam_updates',
      'attendance_alerts',
      'timetable_changes',
      'events',
      'placement_news',
      'scholarships',
      'ai_discoveries',
    ];
    const cleanUpdates = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_PREFERENCES) {
      if (preferences[field] !== undefined) {
        if (typeof preferences[field] !== 'boolean') {
          return res.status(400).json({ error: `${field} must be a boolean` });
        }
        cleanUpdates[field] = preferences[field];
      }
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .update(cleanUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    sendError(res, error);
  }
});

// ============================================
// ADMIN NOTIFICATION ENDPOINTS
// ============================================

/**
 * POST /api/notifications/admin/broadcast
 * Broadcast notification to specific audience (admin only)
 */
router.post('/admin/broadcast', authRequired, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { title, message, type, priority, targetAudience, data } = req.body;

    if (!title || !message || !type) {
      return res.status(400).json({ error: 'Missing required fields: title, message, type' });
    }

    const notificationData = {
      title,
      message,
      type,
      priority: priority || 'normal',
      data
    };

    const notifications = await createNotificationForAudience(targetAudience, notificationData);
    res.json({ success: true, created: notifications.length, notifications });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    sendError(res, error);
  }
});

/**
 * GET /api/notifications/admin/stats
 * Get notification statistics (admin only)
 */
router.get('/admin/stats', authRequired, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    // Get various notification statistics
    const [totalResult, unreadResult, pendingResult, sentResult] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('status', 'sent')
    ]);

    const stats = {
      total: totalResult.count || 0,
      unread: unreadResult.count || 0,
      pending: pendingResult.count || 0,
      sent: sentResult.count || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    sendError(res, error);
  }
});

/**
 * GET /api/notifications/admin/recent
 * Get recent notifications across all users (admin only)
 */
router.get('/admin/recent', authRequired, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const { data, error } = await supabase
      .from('notifications')
      .select('*, profiles(full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    res.json({ data, count: data.length });
  } catch (error) {
    console.error('Error fetching recent notifications:', error);
    sendError(res, error);
  }
});

// ============================================
// NOTIFICATION TRIGGER ENDPOINTS
// ============================================

/**
 * POST /api/notifications/trigger/attendance
 * Trigger attendance notification (used by attendance marking)
 */
router.post('/trigger/attendance', authRequired, requireRole('teacher', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { studentId, attendancePercentage, subjectName } = req.body || {};

    // Validate input — never trust req.body.
    if (!studentId || !UUID_RE.test(studentId)) {
      return res.status(400).json({ error: 'studentId must be a valid UUID' });
    }
    const percentage = Number(attendancePercentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return res.status(400).json({ error: 'attendancePercentage must be a number between 0 and 100' });
    }

    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('profile_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Check if attendance is below threshold (75%)
    if (percentage < 75) {
      const shouldNotify = await shouldSendNotification(student.profile_id, 'attendance');
      
      if (shouldNotify) {
        await createNotificationForUsers([student.profile_id], {
          title: 'Low Attendance Alert',
          message: `Your attendance in ${subjectName} has fallen to ${percentage}%. Please attend classes regularly.`,
          type: 'attendance',
          priority: 'high',
          data: { attendancePercentage: percentage, subjectName }
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error triggering attendance notification:', error);
    sendError(res, error);
  }
});

/**
 * POST /api/notifications/trigger/marks
 * Trigger marks notification (used when marks are published)
 */
router.post('/trigger/marks', authRequired, requireRole('teacher', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { studentIds, assessmentTitle, subjectName } = req.body || {};

    // Validate input — never trust req.body.
    if (
      !Array.isArray(studentIds) ||
      studentIds.length === 0 ||
      studentIds.length > 200 ||
      !studentIds.every((id) => typeof id === 'string' && UUID_RE.test(id))
    ) {
      return res.status(400).json({ error: 'studentIds must be an array of student UUIDs (max 200)' });
    }
    if (typeof assessmentTitle !== 'string' || !assessmentTitle.trim() ||
        typeof subjectName !== 'string' || !subjectName.trim()) {
      return res.status(400).json({ error: 'assessmentTitle and subjectName are required' });
    }

    // Get student profiles
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('profile_id')
      .in('id', studentIds);

    if (studentsError) throw studentsError;

    const userIds = students.map(s => s.profile_id);
    
    // Filter by preferences
    const eligibleUserIds = [];
    for (const userId of userIds) {
      const shouldNotify = await shouldSendNotification(userId, 'exam');
      if (shouldNotify) eligibleUserIds.push(userId);
    }

    if (eligibleUserIds.length > 0) {
      await createNotificationForUsers(eligibleUserIds, {
        title: 'Marks Published',
        message: `Your marks for ${assessmentTitle} (${subjectName}) have been published.`,
        type: 'exam',
        priority: 'normal',
        data: { assessmentTitle, subjectName }
      });
    }

    res.json({ success: true, notified: eligibleUserIds.length });
  } catch (error) {
    console.error('Error triggering marks notification:', error);
    sendError(res, error);
  }
});

/**
 * POST /api/notifications/trigger/announcement
 * Trigger announcement notification (used when announcement is published)
 */
router.post('/trigger/announcement', authRequired, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { announcementId, title, targetAudience } = req.body;

    await createNotificationForAudience(targetAudience, {
      title: 'New Announcement',
      message: title,
      type: 'announcement',
      priority: 'normal',
      data: { announcementId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error triggering announcement notification:', error);
    sendError(res, error);
  }
});

/**
 * POST /api/notifications/trigger/news
 * Trigger news notification (used when AI publishes news)
 */
router.post('/trigger/news', authRequired, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { newsId, title, category } = req.body;

    // Filter users who want AI discoveries
    const { data: profiles, error: profilesError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('ai_discoveries', true);

    if (profilesError) throw profilesError;

    const userIds = profiles.map(p => p.user_id);
    
    if (userIds.length > 0) {
      await createNotificationForUsers(userIds, {
        title: 'New College Update',
        message: title,
        type: 'ai_news',
        priority: 'normal',
        data: { newsId, category }
      });
    }

    res.json({ success: true, notified: userIds.length });
  } catch (error) {
    console.error('Error triggering news notification:', error);
    sendError(res, error);
  }
});

export default router;