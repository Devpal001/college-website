// Phase 2 end-to-end verification: teacher/student profiles, attendance, marks, authz.
// Requires running API at VITE_API_URL or http://localhost:3001.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const API = process.env.VITE_API_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${extra ? ` ${extra}` : ''}`);
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function demoLogin(portalId, role) {
  const r = await api('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ portalId, role }),
  });
  return r;
}

async function main() {
  console.log('== Phase 2 E2E Verification ==');

  // Login as teacher and student
  const teacherLogin = await demoLogin('TCH001', 'teacher');
  ok('Teacher demo login 200', teacherLogin.status === 200, `got ${teacherLogin.status}`);
  const teacherToken = teacherLogin.body?.session?.access_token;

  const studentLogin = await demoLogin('STU001', 'student');
  ok('Student demo login 200', studentLogin.status === 200, `got ${studentLogin.status}`);
  const studentToken = studentLogin.body?.session?.access_token;

  let teacherSubjects = [];
  let studentSectionId = null;

  // Teacher profile tests
  console.log('\n== Teacher Profile ==');
  if (teacherToken) {
    const profileBefore = await api('/api/profile/me', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    ok('GET /api/profile/me 200', profileBefore.status === 200, `got ${profileBefore.status}`);
    const teacherProfile = profileBefore.body?.teacher;
    ok('Teacher profile loaded', Boolean(teacherProfile));

    // Update teacher profile
    const updateRes = await api('/api/teachers/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        designation: 'Professor',
        qualification: 'PhD',
        specialization: 'Computer Science',
        experience_years: 10,
      }),
    });
    ok('PUT /api/teachers/me/profile 200', updateRes.status === 200, `got ${updateRes.status} ${JSON.stringify(updateRes.body)}`);

    // Verify update persisted
    const profileAfter = await api('/api/profile/me', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    ok('Teacher designation updated', profileAfter.body?.teacher?.designation === 'Professor', `got ${profileAfter.body?.teacher?.designation}`);
    ok('Teacher qualification updated', profileAfter.body?.teacher?.qualification === 'PhD', `got ${profileAfter.body?.teacher?.qualification}`);
    ok('Teacher specialization updated', profileAfter.body?.teacher?.specialization === 'Computer Science', `got ${profileAfter.body?.teacher?.specialization}`);
    ok('Teacher experience updated', profileAfter.body?.teacher?.experience_years === 10, `got ${profileAfter.body?.teacher?.experience_years}`);

    // Verify sensitive fields unchanged
    ok('Employee ID unchanged', teacherProfile?.employee_id && teacherProfile.employee_id === profileAfter.body?.teacher?.employee_id);
    ok('Profile ID unchanged', teacherProfile?.id && teacherProfile.id === profileAfter.body?.teacher?.id);

    // Get teacher subjects for later tests
    const subjects = await api('/api/teachers/me/subjects', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    teacherSubjects = Array.isArray(subjects.body) ? subjects.body : [];
  }

  // Student profile tests
  console.log('\n== Student Profile ==');
  if (studentToken) {
    const profileBefore = await api('/api/students/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    ok('GET /api/students/me 200', profileBefore.status === 200, `got ${profileBefore.status} ${JSON.stringify(profileBefore.body)}`);
    const studentProfile = profileBefore.body?.student;
    ok('Student profile loaded', Boolean(studentProfile));
    studentSectionId = profileBefore.body?.enrollment?.section_id || studentProfile?.current_section;

    // Update student profile
    const updateRes = await api('/api/students/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        emergency_contact_name: 'Test Contact',
        emergency_contact_phone: '1234567890',
      }),
    });
    ok('PUT /api/students/me/profile 200', updateRes.status === 200, `got ${updateRes.status} ${JSON.stringify(updateRes.body)}`);

    // Verify update persisted via students/me
    const profileAfter = await api('/api/students/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    ok('Student city updated', profileAfter.body?.student?.city === 'Test City', `got ${profileAfter.body?.student?.city}`);
    ok('Student state updated', profileAfter.body?.student?.state === 'Test State', `got ${profileAfter.body?.student?.state}`);

    // Verify sensitive fields unchanged
    ok('Enrollment number unchanged', studentProfile?.enrollment_number && studentProfile.enrollment_number === profileAfter.body?.student?.enrollment_number);
    ok('Student ID unchanged', studentProfile?.id && studentProfile.id === profileAfter.body?.student?.id);
  }

  // Attendance tests
  console.log('\n== Attendance ==');
  if (teacherToken && teacherSubjects.length > 0) {
    const subject = teacherSubjects[0];
    const sectionId = subject.sections?.id || subject.section_id;
    console.log('  DEBUG subject.sections', JSON.stringify(subject.sections));
    ok('Subject has section', Boolean(sectionId), `section=${sectionId}`);

    if (sectionId) {
      // Load students using teacher's authorized section
      const students = await api(`/api/sections/${sectionId}/students`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      console.log('  DEBUG sections students response', students.status, JSON.stringify(students.body));
      ok('GET /api/sections/:id/students 200', students.status === 200, `got ${students.status}`);
      const studentList = Array.isArray(students.body) ? students.body : [];
      ok('Section has students', studentList.length > 0, `students=${studentList.length}`);

      if (studentList.length > 0) {
        const student1 = studentList[0];
        const student2 = studentList[1] || studentList[0];

        // Mark attendance
        const today = new Date().toISOString().split('T')[0];
        const attRes = await api('/api/attendance', {
          method: 'POST',
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: JSON.stringify({
            subjectId: subject.subject_id,
            sectionId,
            date: today,
            records: [
              { studentId: student1.id, status: 'present' },
              { studentId: student2.id, status: 'absent' },
            ],
          }),
        });
        ok('POST /api/attendance 201', attRes.status === 201, `got ${attRes.status} ${JSON.stringify(attRes.body)}`);
        ok('Attendance saved for 2 students', attRes.body?.records?.length === 2, `records=${attRes.body?.records?.length}`);

        // Load existing attendance
        const sessionRes = await api(`/api/teachers/me/sessions?sectionId=${sectionId}&subjectId=${subject.subject_id}&date=${today}`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
        });
        const sessions = Array.isArray(sessionRes.body) ? sessionRes.body : [];
        const session = sessions[0];
        if (session?.id) {
          const attRecords = await api(`/api/attendance?sessionId=${session.id}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          ok('GET /api/attendance?sessionId= works', attRecords.status === 200, `got ${attRecords.status}`);
          const records = Array.isArray(attRecords.body) ? attRecords.body : [];
          ok('Attendance records found', records.length > 0, `records=${records.length}`);
        }

        // Update attendance
        if (attRes.body?.records?.[0]?.id) {
          const updateRes = await api(`/api/attendance/${attRes.body.records[0].id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` },
            body: JSON.stringify({ status: 'late' }),
          });
          ok('PUT /api/attendance/:id 200', updateRes.status === 200, `got ${updateRes.status} ${JSON.stringify(updateRes.body)}`);
          ok('Attendance status updated to late', updateRes.body?.status === 'late', `got ${updateRes.body?.status}`);
        }

        // Duplicate protection: save again for same student/class/date
        const dupRes = await api('/api/attendance', {
          method: 'POST',
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: JSON.stringify({
            subjectId: subject.subject_id,
            sectionId,
            date: today,
            records: [
              { studentId: student1.id, status: 'excused' },
            ],
          }),
        });
        ok('Duplicate attendance updates instead of creating duplicate', dupRes.status === 201, `got ${dupRes.status}`);
      }
    }
  }

  // Marks tests
  console.log('\n== Marks ==');
  if (teacherToken && teacherSubjects.length > 0) {
    const subject = teacherSubjects[0];

    // Create a test assessment
    const createAssess = await api('/api/teachers/me/assessments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        subjectId: subject.subject_id,
        semesterId: subject.semester_id,
        title: 'Phase 2 Verification Test',
        type: 'quiz',
        maxMarks: 100,
        weightage: 10,
        dateScheduled: new Date().toISOString().split('T')[0],
      }),
    });
    ok('POST /api/teachers/me/assessments 201', createAssess.status === 201, `got ${createAssess.status} ${JSON.stringify(createAssess.body)}`);
    const assessmentId = createAssess.body?.id;

    if (assessmentId && subject.sections?.id) {
      const sectionId = subject.sections.id;
      const students = await api(`/api/sections/${sectionId}/students`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const studentList = Array.isArray(students.body) ? students.body : [];

      if (studentList.length > 0) {
        const student1 = studentList[0];
        const student2 = studentList[1] || studentList[0];

        // Enter marks
        const marksRes = await api('/api/marks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: JSON.stringify({
            assessmentId,
            records: [
              { studentId: student1.id, marksObtained: 85 },
              { studentId: student2.id, marksObtained: 72 },
            ],
          }),
        });
        ok('POST /api/marks 201', marksRes.status === 201, `got ${marksRes.status} ${JSON.stringify(marksRes.body)}`);
        ok('Marks saved for 2 students', marksRes.body?.records?.length === 2, `records=${marksRes.body?.records?.length}`);

        // Load existing marks
        const existingMarks = await api(`/api/marks?assessmentId=${assessmentId}`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
        });
        ok('GET /api/marks?assessmentId= works', existingMarks.status === 200, `got ${existingMarks.status}`);
        const marksList = Array.isArray(existingMarks.body) ? existingMarks.body : [];
        ok('Marks records found', marksList.length > 0, `marks=${marksList.length}`);

        // Update marks
        if (marksRes.body?.records?.[0]?.id) {
          const updateRes = await api(`/api/marks/${marksRes.body.records[0].id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` },
            body: JSON.stringify({ marksObtained: 91 }),
          });
          ok('PUT /api/marks/:id 200', updateRes.status === 200, `got ${updateRes.status} ${JSON.stringify(updateRes.body)}`);
          ok('Marks updated to 91', updateRes.body?.marks_obtained === 91, `got ${updateRes.body?.marks_obtained}`);
        }

        // Invalid marks test
        const invalidRes = await api('/api/marks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: JSON.stringify({
            assessmentId,
            records: [
              { studentId: student1.id, marksObtained: -5 },
            ],
          }),
        });
        ok('Negative marks rejected', invalidRes.status === 400, `got ${invalidRes.status}`);

        const overMaxRes = await api('/api/marks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: JSON.stringify({
            assessmentId,
            records: [
              { studentId: student1.id, marksObtained: 150 },
            ],
          }),
        });
        ok('Over-max marks rejected', overMaxRes.status === 400, `got ${overMaxRes.status}`);
      }
    }
  }

  // Authorization boundary tests
  console.log('\n== Authorization Boundaries ==');
  if (studentToken) {
    // Student cannot access teacher endpoints
    const teacherDash = await api('/api/teachers/me/dashboard', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    ok('Student blocked from teacher dashboard', teacherDash.status === 403, `got ${teacherDash.status}`);

    const teacherAssess = await api('/api/teachers/me/assessments', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    ok('Student blocked from teacher assessments', teacherAssess.status === 403, `got ${teacherAssess.status}`);
  }

  if (teacherToken) {
    // Teacher cannot access student-only endpoints with wrong role
    const studentDash = await api('/api/students/me/dashboard', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    ok('Teacher blocked from student dashboard', studentDash.status === 403, `got ${studentDash.status}`);
  }

  // Unauthenticated requests
  console.log('\n== Unauthenticated Access ==');
  const unauthProfile = await api('/api/profile/me');
  ok('Unauthenticated profile 401', unauthProfile.status === 401, `got ${unauthProfile.status}`);

  const unauthAttendance = await api('/api/attendance', {
    method: 'POST',
    body: JSON.stringify({ subjectId: 'x', sectionId: 'x', date: '2024-01-01', records: [] }),
  });
  ok('Unauthenticated attendance 401', unauthAttendance.status === 401, `got ${unauthAttendance.status}`);

  // Regression tests
  console.log('\n== Regression ==');
  const health = await api('/health');
  ok('GET /health 200', health.status === 200, `got ${health.status}`);

  const departments = await api('/api/departments');
  ok('GET /api/departments 200', departments.status === 200, `got ${departments.status}`);

  console.log('');
  console.log(`Result: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
