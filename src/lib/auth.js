// Re-use the single shared Supabase client from lib/supabase.js.
// Creating a second client with the same storage key caused the
// "Multiple GoTrueClient instances detected" console warning and
// could make auth-state updates unreliable.
import { supabase } from './supabase';
import { api } from './api';

export { supabase };

// ============================================
// AUTHENTICATION HELPERS
// ============================================

// ============================================
// PORTAL (DEMO) AUTHENTICATION
// ============================================

/**
 * Sign in through the MBSCET portal using an institutional ID + portal role.
 * The Express backend (/api/auth/demo-login) verifies the ID against the
 * database server-side (students.enrollment_number / teachers.employee_id /
 * DEMO_ADMIN_IDS) and returns a real Supabase session — the frontend never
 * decides the role. On success the session is stored so useAuth,
 * ProtectedRoute and the Navbar pick it up through the normal flow.
 *
 * ⚠️ DEMO-ONLY by design — ID-only, not production-secure. Replace with
 *    password/PIN/SSO before production deployment (see server/routes/auth.js
 *    and the banner on the /login page).
 */
export async function signInWithPortalId(portalId, role) {
  // POST is intentionally unauthenticated (no session exists yet).
  const { session, profile, user } = await api.post('/auth/demo-login', {
    portalId,
    role,
  });

  // Maintain a real Supabase session for the remainder of the app session.
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;

  return { session, profile, user };
}

/**
 * Role → portal dashboard route (single source of truth).
 */
export function dashboardPathForRole(role) {
  if (role === 'student') return '/student-dashboard';
  if (role === 'teacher') return '/teacher-dashboard';
  if (role === 'admin' || role === 'super_admin') return '/admin-dashboard';
  return '/login';
}
export async function signUpWithEmail(email, password, fullName, role = 'student') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role
      }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// ============================================
// USER PROFILE HELPERS
// ============================================

/**
 * Get user profile with role
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if user has specific role
 */
export async function hasRole(userId, requiredRole) {
  const profile = await getUserProfile(userId);
  return profile.role === requiredRole;
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(userId, roles) {
  const profile = await getUserProfile(userId);
  return roles.includes(profile.role);
}

/**
 * Check if user is admin (admin or super_admin)
 */
export async function isAdmin(userId) {
  return await hasAnyRole(userId, ['admin', 'super_admin']);
}

/**
 * Check if user is student
 */
export async function isStudent(userId) {
  return await hasRole(userId, 'student');
}

/**
 * Check if user is teacher
 */
export async function isTeacher(userId) {
  return await hasRole(userId, 'teacher');
}

// ============================================
// STUDENT-SPECIFIC HELPERS
// ============================================

/**
 * Get student data by user ID
 */
export async function getStudentData(userId) {
  const { data, error } = await supabase
    .from('students')
    .select('*, profiles(*), departments(*)')
    .eq('profile_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get student attendance overview
 */
export async function getStudentAttendanceOverview(studentId, semesterId = null) {
  let query = supabase
    .from('attendance')
    .select('*, attendance_sessions(*), subjects(*)')
    .eq('student_id', studentId);

  if (semesterId) {
    query = query.eq('attendance_sessions.semester_id', semesterId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get student marks overview
 */
export async function getStudentMarksOverview(studentId, semesterId = null) {
  let query = supabase
    .from('marks')
    .select('*, assessments(*), subjects(*)')
    .eq('student_id', studentId);

  if (semesterId) {
    query = query.eq('assessments.semester_id', semesterId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get student timetable
 */
export async function getStudentTimetable(studentId) {
  // First get student's current section
  const studentData = await getStudentData(studentId);
  if (!studentData) return [];

  const { data, error } = await supabase
    .from('timetable')
    .select('*, subjects(*), teachers(*), rooms(*)')
    .eq('section_id', studentData.section_id)
    .order('day_of_week')
    .order('start_time');

  if (error) throw error;
  return data;
}

// ============================================
// TEACHER-SPECIFIC HELPERS
// ============================================

/**
 * Get teacher data by user ID
 */
export async function getTeacherData(userId) {
  const { data, error } = await supabase
    .from('teachers')
    .select('*, profiles(*), departments(*)')
    .eq('profile_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get teacher's assigned subjects
 */
export async function getTeacherAssignedSubjects(teacherId, semesterId = null) {
  let query = supabase
    .from('teacher_subjects')
    .select('*, subjects(*), semesters(*), sections(*)')
    .eq('teacher_id', teacherId)
    .eq('is_active', true);

  if (semesterId) {
    query = query.eq('semester_id', semesterId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get teacher's assigned classes for a subject
 */
export async function getTeacherClasses(teacherId, subjectId, semesterId) {
  const { data, error } = await supabase
    .from('teacher_subjects')
    .select('*, sections(*), semesters(*)')
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)
    .eq('semester_id', semesterId)
    .eq('is_active', true);

  if (error) throw error;
  return data;
}

// ============================================
// NOTIFICATION HELPERS
// ============================================

/**
 * Get user notifications
 */
export async function getUserNotifications(userId, unreadOnly = false) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({
      read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({
      read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return data;
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(userId) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(userId, preferences) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .update({
      ...preferences,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// ANNOUNCEMENT & EVENT HELPERS
// ============================================

/**
 * Get relevant announcements for user
 */
export async function getRelevantAnnouncements(userRole, userDepartment = null, userSemester = null) {
  let query = supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString() || '9999-12-31')
    .order('published_at', { ascending: false })
    .limit(20);

  const { data, error } = await query;

  if (error) throw error;
  
  // Filter by target audience (this would be more sophisticated in production)
  return data.filter(announcement => {
    const targets = announcement.target_audience || [];
    return targets.includes('all') || 
           targets.includes(userRole) ||
           (userDepartment && targets.includes(userDepartment)) ||
           (userSemester && targets.includes(userSemester));
  });
}

/**
 * Get upcoming events
 */
export async function getUpcomingEvents(limit = 10) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ============================================
// ADMIN HELPERS
// ============================================

/**
 * Get all students (admin only)
 */
export async function getAllStudents(filters = {}) {
  let query = supabase
    .from('students')
    .select('*, profiles(*), departments(*)');

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }
  if (filters.semester) {
    query = query.eq('current_semester', filters.semester);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get all teachers (admin only)
 */
export async function getAllTeachers(filters = {}) {
  let query = supabase
    .from('teachers')
    .select('*, profiles(*), departments(*)');

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get audit logs (admin only)
 */
export async function getAuditLogs(filters = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*, profiles(*)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.tableName) {
    query = query.eq('table_name', filters.tableName);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

// ============================================
// AI & NEWS HELPERS
// ============================================

/**
 * Get published news
 */
export async function getPublishedNews(category = null, limit = 20) {
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
 * Get pending news for admin review
 */
export async function getPendingNews() {
  const { data, error } = await supabase
    .from('news_items')
    .select('*, news_sources(*)')
    .eq('verification_status', 'pending')
    .order('retrieved_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Approve or reject news item
 */
export async function verifyNewsItem(newsId, status, publishedBy) {
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
    .eq('id', newsId)
    .select()
    .single();

  if (error) throw error;
  return data;
}