-- ============================================
-- COLLEGE DIGITAL PLATFORM - SUPABASE SCHEMA
-- ============================================
-- This schema extends the default Supabase auth tables
-- with comprehensive academic and administrative functionality

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES & USER MANAGEMENT
-- ============================================

-- User profiles (extends Supabase auth.users)
-- institutional_id: unified human-facing institutional identity
--   (backfilled from students.enrollment_number / teachers.employee_id for
--   existing databases — see migrations/2026_09_05_phase0_identity_foundations.sql;
--   administrator IDs are assigned through the provisioning/registry process).
-- status: account lifecycle; authoritative over the legacy is_active boolean
--   (kept synchronized by the sync_profile_status() trigger below).
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'super_admin')),
  institutional_id TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'disabled')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Students table
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  enrollment_number TEXT UNIQUE NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  blood_group TEXT,
  admission_date DATE,
  current_semester INTEGER CHECK (current_semester > 0),
  current_section TEXT,
  department_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teachers table
CREATE TABLE teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  designation TEXT,
  qualification TEXT,
  specialization TEXT,
  experience_years INTEGER,
  department_id UUID,
  date_of_joining DATE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Account activation credentials (Phase 1)
-- One-time activation codes for PENDING institutional accounts registered
-- through the admin identity registry (POST /api/users/registry). Only a
-- SHA-256 hash of the code is stored; codes are single-use and expiring.
-- RLS deny-by-default: anonymous/authenticated clients have NO access;
-- only the server-side service_role is granted access (--privileged policy).
CREATE TABLE account_activations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ACADEMIC STRUCTURE
-- ============================================

-- Departments
CREATE TABLE departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  hod_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  description TEXT,
  established_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  duration_years INTEGER NOT NULL,
  total_semesters INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Semesters
CREATE TABLE semesters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  semester_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(course_id, semester_number),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sections
CREATE TABLE sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER,
  room_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subjects
CREATE TABLE subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  credits INTEGER NOT NULL,
  description TEXT,
  is_lab BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student enrollments
CREATE TABLE enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'dropped')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, semester_id)
);

-- Teacher-subject assignments
CREATE TABLE teacher_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  assigned_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id, semester_id, section_id)
);

-- ============================================
-- ACADEMIC RECORDS
-- ============================================

-- Rooms
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  building TEXT,
  capacity INTEGER,
  type TEXT CHECK (type IN ('classroom', 'lab', 'seminar', 'auditorium', 'other')),
  equipment TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timetable
CREATE TABLE timetable (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  academic_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance sessions
CREATE TABLE attendance_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section_id, subject_id, date)
);

-- Attendance records
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Assessments
CREATE TABLE assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('assignment', 'quiz', 'midterm', 'practical', 'final', 'other')),
  max_marks DECIMAL(5,2) NOT NULL,
  weightage DECIMAL(5,2),
  date_scheduled DATE,
  date_conducted DATE,
  created_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marks
CREATE TABLE marks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  marks_obtained DECIMAL(5,2) NOT NULL,
  marks_max DECIMAL(5,2) NOT NULL,
  remarks TEXT,
  entered_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assessment_id, student_id)
);

-- ============================================
-- CONTENT & ANNOUNCEMENTS
-- ============================================

-- Announcements
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('exam', 'holiday', 'result', 'admission', 'scholarship', 'event', 'placement', 'deadline', 'timetable', 'academic', 'administrative', 'general', 'urgent')),
  target_audience TEXT[] CHECK (cardinality(target_audience) > 0),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  venue TEXT,
  organizer TEXT,
  category TEXT CHECK (category IN ('academic', 'cultural', 'sports', 'seminar', 'workshop', 'other')),
  target_audience TEXT[],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT CHECK (category IN ('syllabus', 'timetable', 'exam', 'notes', 'forms', 'other')),
  target_audience TEXT[],
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admissions
CREATE TABLE admissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  course_applied TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected'))
);

-- ============================================
-- NOTIFICATION SYSTEM
-- ============================================

-- Notifications
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('announcement', 'attendance', 'marks', 'timetable', 'exam', 'event', 'system', 'ai_news')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'cancelled')),
  read_at TIMESTAMP WITH TIME ZONE,
  read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  college_announcements BOOLEAN DEFAULT true,
  exam_updates BOOLEAN DEFAULT true,
  attendance_alerts BOOLEAN DEFAULT true,
  timetable_changes BOOLEAN DEFAULT true,
  events BOOLEAN DEFAULT true,
  placement_news BOOLEAN DEFAULT true,
  scholarships BOOLEAN DEFAULT true,
  ai_discoveries BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AI & NEWS SYSTEM
-- ============================================

-- News sources
CREATE TABLE news_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('official_college', 'official_university', 'official_department', 'approved_external')),
  category TEXT CHECK (category IN ('general', 'exam', 'admission', 'placement', 'academic', 'administrative')),
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  check_frequency_hours INTEGER DEFAULT 24,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- News items
CREATE TABLE news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES news_sources(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT NOT NULL,
  published_date TIMESTAMP WITH TIME ZONE,
  retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT CHECK (category IN ('exam', 'holiday', 'result', 'admission', 'scholarship', 'event', 'placement', 'deadline', 'timetable', 'academic', 'administrative', 'general', 'urgent')),
  target_audience TEXT[],
  confidence_score DECIMAL(3,2),
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'flagged')),
  canonical_news_id UUID REFERENCES news_items(id) ON DELETE SET NULL,
  content_hash TEXT,
  is_published BOOLEAN DEFAULT false,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI agent runs
CREATE TABLE ai_agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  source_id UUID REFERENCES news_sources(id) ON DELETE SET NULL,
  action TEXT,
  confidence DECIMAL(3,2),
  result JSONB,
  error TEXT,
  tool_calls JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI agent events
CREATE TABLE ai_agent_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_run_id UUID REFERENCES ai_agent_runs(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data JSONB,
  metadata JSONB
);

-- ============================================
-- SYSTEM & AUDIT
-- ============================================

-- Audit logs
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Profile indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Student indexes
CREATE INDEX idx_students_enrollment ON students(enrollment_number);
CREATE INDEX idx_students_department ON students(department_id);
CREATE INDEX idx_students_semester ON students(current_semester);

-- Teacher indexes
CREATE INDEX idx_teachers_employee ON teachers(employee_id);
CREATE INDEX idx_teachers_department ON teachers(department_id);

-- Academic indexes
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_semester ON enrollments(semester_id);
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_marks_assessment ON marks(assessment_id);
CREATE INDEX idx_marks_student ON marks(student_id);

-- Notification indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_read ON notifications(read);

-- News indexes
CREATE INDEX idx_news_source ON news_items(source_id);
CREATE INDEX idx_news_status ON news_items(verification_status);
CREATE INDEX idx_news_published ON news_items(is_published);

-- Audit indexes
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marks_updated_at BEFORE UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_items_updated_at BEFORE UPDATE ON news_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

-- Helper functions for non-recursive role checks (used by RLS policies)
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_current_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profile policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (auth_is_admin());

-- Student policies
CREATE POLICY "Students can view own data" ON students
    FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Teachers can view their students" ON students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM teacher_subjects ts
            JOIN semesters s ON ts.semester_id = s.id
            JOIN enrollments e ON s.id = e.semester_id
            JOIN teachers t ON ts.teacher_id = t.id
            WHERE t.profile_id = auth.uid()
              AND e.student_id = students.id
        )
    );

CREATE POLICY "Admins can view all students" ON students
    FOR ALL USING (auth_is_admin());

-- Teacher policies
CREATE POLICY "Teachers can view own data" ON teachers
    FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all teachers" ON teachers
    FOR ALL USING (auth_is_admin());

-- Attendance policies
CREATE POLICY "Students can view own attendance" ON attendance
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM students WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can view class attendance" ON attendance
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM attendance_sessions
            WHERE teacher_id IN (
                SELECT id FROM teachers WHERE profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "Teachers can mark attendance" ON attendance
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT id FROM attendance_sessions
            WHERE teacher_id IN (
                SELECT id FROM teachers WHERE profile_id = auth.uid()
            )
        )
    );

-- Marks policies
CREATE POLICY "Students can view own marks" ON marks
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM students WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can view subject marks" ON marks
    FOR SELECT USING (
        assessment_id IN (
            SELECT id FROM assessments
            WHERE subject_id IN (
                SELECT subject_id FROM teacher_subjects
                WHERE teacher_id IN (
                    SELECT id FROM teachers WHERE profile_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Teachers can enter marks" ON marks
    FOR INSERT WITH CHECK (
        assessment_id IN (
            SELECT id FROM assessments
            WHERE subject_id IN (
                SELECT subject_id FROM teacher_subjects
                WHERE teacher_id IN (
                    SELECT id FROM teachers WHERE profile_id = auth.uid()
                )
            )
        )
    );

-- Notification policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can manage own preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- News policies (public can view published news)
CREATE POLICY "Public can view published news" ON news_items
    FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage news" ON news_items
    FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- Public read for reference data
CREATE POLICY "Public can read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Public can read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Public can read semesters" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public can read sections" ON sections FOR SELECT USING (true);
CREATE POLICY "Public can read subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public can read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public can read enrollments" ON enrollments FOR SELECT USING (true);
CREATE POLICY "Public can read teacher_subjects" ON teacher_subjects FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read timetable" ON timetable FOR SELECT USING (true);
CREATE POLICY "Authenticated can read attendance_sessions" ON attendance_sessions
    FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND (
            auth_is_admin()
            OR attendance_sessions.teacher_id IN (
                SELECT id FROM teachers WHERE profile_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
                  AND e.section_id = attendance_sessions.section_id
            )
        )
    );
CREATE POLICY "Public can read announcements" ON announcements FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public can read news_sources" ON news_sources FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated can read documents" ON documents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Public can submit admissions" ON admissions FOR INSERT WITH CHECK (true);

-- AI agent runs: admin-only access (metadata stays privileged)
CREATE POLICY "Admins can view ai_agent_runs" ON ai_agent_runs
    FOR SELECT USING (auth_is_admin());
CREATE POLICY "Admins can manage ai_agent_runs" ON ai_agent_runs
    FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage ai_agent_events" ON ai_agent_events
    FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- Audit log policies
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (auth_is_admin());

-- Admin manage policies for reference data
CREATE POLICY "Admins can manage departments" ON departments FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage courses" ON courses FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage semesters" ON semesters FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage sections" ON sections FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage subjects" ON subjects FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage rooms" ON rooms FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage teacher_subjects" ON teacher_subjects FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage assessments" ON assessments FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage events" ON events FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage news_sources" ON news_sources FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage documents" ON documents FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage all notifications" ON notifications FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can view all notifications" ON notifications FOR SELECT USING (auth_is_admin());
CREATE POLICY "Admins can manage all preferences" ON notification_preferences FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- Account activation: deny-by-default for browsers; service_role granted explicit access
CREATE POLICY "Service role manages account activations"
  ON public.account_activations
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FUNCTIONS FOR AUTOMATED PROFILE CREATION
-- ============================================

-- Function to create profile automatically on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ACCOUNT LIFECYCLE SYNC (status <-> is_active)
-- ============================================
-- `status` is the authoritative lifecycle field (pending/active/suspended/
-- disabled). The legacy `is_active` boolean is preserved for transition-era
-- readers/writers and kept synchronized by this trigger. Existing databases
-- receive this via migrations/2026_09_05_phase0_identity_foundations.sql.
CREATE OR REPLACE FUNCTION public.sync_profile_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active THEN
      IF OLD.status = 'suspended' THEN
        NEW.status := 'active';
      END IF;
    ELSE
      IF OLD.status = 'active' THEN
        NEW.status := 'suspended';
      END IF;
    END IF;
    NEW.is_active := (NEW.status = 'active');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_status ON public.profiles;
CREATE TRIGGER trg_profiles_sync_status
    BEFORE INSERT OR UPDATE OF status, is_active ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_status();

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- ============================================
-- INITIALIZATION DATA
-- ============================================

-- Insert initial departments (will be updated with actual data)
INSERT INTO departments (name, code, description, established_year) VALUES
('Computer Science Engineering', 'CSE', 'Software development, AI/ML, and systems design', 1999),
('Electrical Engineering', 'EE', 'Power systems, control engineering, and electrical design', 1999),
('Electronics & Communication', 'ECE', 'Circuit design, communication systems, and embedded tech', 1999),
('Mechanical Engineering', 'ME', 'Design, manufacturing, and thermal systems', 1999),
('Information Technology', 'IT', 'Networks, databases, and application development', 2005),
('Civil Engineering', 'CE', 'Structural design, construction, and infrastructure', 2010),
('Applied Science & Humanities', 'ASH', 'Foundational sciences and communication skills', 1999)
ON CONFLICT (code) DO NOTHING;

-- Insert initial news sources
INSERT INTO news_sources (name, url, type, category, priority) VALUES
('MBSCET Official Website', 'https://mbscet.edu.in', 'official_college', 'general', 1),
('University of Jammu', 'https://www.jammuuniversity.in', 'official_university', 'academic', 2),
('AICTE', 'https://www.aicte-india.org', 'approved_external', 'administrative', 3)
ON CONFLICT (url) DO NOTHING;