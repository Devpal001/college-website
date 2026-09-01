-- ============================================================
-- Migration: Fix RLS infinite recursion + add missing policies
-- Date: 2026-09-01
-- =============================================================
-- ROOT CAUSE (proven by live probe, audit-rls.mjs):
--   The "Admins can view all profiles" policy (schema.sql:551)
--   contains a subquery on `profiles` itself -> PostgreSQL raises
--   "infinite recursion detected in policy for relation profiles"
--   on EVERY SELECT against profiles, for EVERY role, including
--   the admin who owns the policy.
--
--   This cascaded to students, teachers, attendance, marks,
--   news_items and audit_logs — all of which reach `profiles`
--   via nested subqueries -> all returned ERROR -> broken auth
--   state (profile=null -> ProtectedRoute role check skipped).
--
-- FIX: two SECURITY DEFINER helpers read profiles with RLS
--   bypassed, eliminating self-reference. All recursive policies
--   rewritten to call them. Missing policies added.
-- ============================================================

-- 1) Helper functions (SECURITY DEFINER -> bypasses RLS -> no recursion)
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


-- 2) Fix profiles — remove the recursive self-subquery
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (auth_is_admin());

-- 3) Fix students — remove recursion-causing subqueries
DROP POLICY IF EXISTS "Students can view own data" ON students;
CREATE POLICY "Students can view own data" ON students
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view their students" ON students;
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

DROP POLICY IF EXISTS "Admins can view all students" ON students;
CREATE POLICY "Admins can view all students" ON students
    FOR ALL USING (auth_is_admin());

-- 4) Fix teachers — remove recursion-causing subqueries
DROP POLICY IF EXISTS "Teachers can view own data" ON teachers;
CREATE POLICY "Teachers can view own data" ON teachers
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all teachers" ON teachers;
CREATE POLICY "Admins can view all teachers" ON teachers
    FOR ALL USING (auth_is_admin());

-- 5) Fix attendance — remove recursion-causing subqueries
DROP POLICY IF EXISTS "Students can view own attendance" ON attendance;
CREATE POLICY "Students can view own attendance" ON attendance
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM students WHERE profile_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Teachers can view class attendance" ON attendance;
CREATE POLICY "Teachers can view class attendance" ON attendance
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM attendance_sessions
            WHERE teacher_id IN (
                SELECT id FROM teachers WHERE profile_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Teachers can mark attendance" ON attendance;
CREATE POLICY "Teachers can mark attendance" ON attendance
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT id FROM attendance_sessions
            WHERE teacher_id IN (
                SELECT id FROM teachers WHERE profile_id = auth.uid()
            )
        )
    );

-- 6) Fix marks — remove recursion-causing subqueries
DROP POLICY IF EXISTS "Students can view own marks" ON marks;
CREATE POLICY "Students can view own marks" ON marks
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM students WHERE profile_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Teachers can view subject marks" ON marks;
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

DROP POLICY IF EXISTS "Teachers can enter marks" ON marks;
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

-- 7) Fix news_items — remove recursion-causing subqueries
DROP POLICY IF EXISTS "Admins can manage news" ON news_items;
CREATE POLICY "Admins can manage news" ON news_items
    FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- 8) Fix audit_logs — remove recursion-causing subqueries
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

-- 9) Add missing policies for tables with NO policy (silent deny)
-- Reference data: public read
CREATE POLICY "Public can read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Public can read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Public can read semesters" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public can read sections" ON sections FOR SELECT USING (true);
CREATE POLICY "Public can read subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public can read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public can read enrollments" ON enrollments FOR SELECT USING (true);
CREATE POLICY "Public can read teacher_subjects" ON teacher_subjects FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read timetable" ON timetable FOR SELECT USING (true);
-- attendance_sessions: authenticated only — students see sessions for their
-- enrolled sections, teachers see their assigned sessions, admins see all
CREATE POLICY "Authenticated can read attendance_sessions" ON attendance_sessions
    FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND (
            auth_is_admin()
            OR EXISTS (SELECT 1 FROM teachers WHERE profile_id = auth.uid())
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
CREATE POLICY "Public can read ai_agent_runs" ON ai_agent_runs FOR SELECT USING (status IN ('completed', 'failed', 'cancelled'));

-- Admin manage (write) for reference data
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
CREATE POLICY "Admins can manage ai_agent_runs" ON ai_agent_runs FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage ai_agent_events" ON ai_agent_events FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- Notification ownership + admin access
CREATE POLICY "Admins can view all notifications" ON notifications FOR SELECT USING (auth_is_admin());
CREATE POLICY "Admins can manage all notifications" ON notifications FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY "Admins can manage all preferences" ON notification_preferences FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- Documents: authenticated users can read (syllabus, notices, etc.)
CREATE POLICY "Authenticated can read documents" ON documents FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admissions: public can submit (form), nothing else
CREATE POLICY "Public can submit admissions" ON admissions FOR INSERT WITH CHECK (true);

-- 10) Ensure the profile-creation trigger is present (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


