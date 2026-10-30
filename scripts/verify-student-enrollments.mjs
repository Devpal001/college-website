// ============================================================
// ACADEMIC RECORD CONSISTENCY CHECK (READ-ONLY)
//   node scripts/verify-student-enrollments.mjs
//
// Guards the invariant that decides whether a teacher can record anything for
// a student at all: an `enrollments` row. Teacher class lists
// (GET /api/sections/:sectionId/students) and the POST /api/attendance
// enrollment check are both driven by `enrollments`, and the student dashboard
// reads attendance/marks by students.id. A student account with no active
// enrollment is therefore invisible to every teacher — attendance can never be
// marked (400) and the dashboard legitimately shows "0/0 classes attended".
//
// Also flags rows written outside an enrollment and duplicate displayed names in
// one class, which is how attendance gets saved against the wrong students.id.
//
// Prints no credentials and performs no writes.
// ============================================================

import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(REPO, '.env'), quiet: true });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

const fail = [];
const warn = [];
const label = (student) =>
  `${student.enrollment_number || '(no enroll no)'} / ${student.profiles?.email || 'no profile'}`;

const { data: students, error: studentsError } = await supabase
  .from('students')
  .select('id, enrollment_number, profiles(email, full_name, role, status)')
  .order('enrollment_number');
if (studentsError) {
  console.error(`Cannot read students: ${studentsError.message}`);
  process.exit(1);
}
const { data: enrollments, error: enrollmentsError } = await supabase
  .from('enrollments')
  .select('student_id, status, section_id, semester_id');
const { data: attendance, error: attendanceError } = await supabase
  .from('attendance')
  .select('id, student_id, session_id, attendance_sessions(section_id)');
const { data: marks, error: marksError } = await supabase
  .from('marks')
  .select('id, student_id, assessment_id, assessments(semester_id, title)');
// A failed read must never masquerade as "no problems found".
for (const [table, queryError] of [
  ['enrollments', enrollmentsError],
  ['attendance', attendanceError],
  ['marks', marksError],
]) {
  if (queryError) {
    console.error(`Cannot read ${table}: ${queryError.message}`);
    process.exit(1);
  }
}

const activeEnrollByStudent = new Map();
for (const e of enrollments || []) {
  if (e.status !== 'active') continue;
  if (!activeEnrollByStudent.has(e.student_id)) activeEnrollByStudent.set(e.student_id, []);
  activeEnrollByStudent.get(e.student_id).push(e);
}

console.log(`Checking ${students?.length || 0} student record(s)…\n`);

// 1) Every student record needs an ACTIVE enrollment, or no teacher can ever
//    record attendance/marks for them and their dashboard shows 0/0 forever.
for (const s of students || []) {
  if (!activeEnrollByStudent.has(s.id)) {
    fail.push(
      `${label(s)} has no active enrollments row — invisible in every teacher ` +
        `class list, so attendance/marks cannot be recorded for this account.`
    );
  }
}

// 2) Attendance must belong to a session whose section the student is in.
for (const a of attendance || []) {
  const sectionId = a.attendance_sessions?.section_id;
  const enrolled = (activeEnrollByStudent.get(a.student_id) || []).some((e) => e.section_id === sectionId);
  if (!enrolled) {
    const s = (students || []).find((x) => x.id === a.student_id);
    fail.push(`attendance ${a.id} for ${s ? label(s) : a.student_id} has no active enrollment in session section ${sectionId}`);
  }
}

// 3) Marks must belong to a student enrolled in that assessment's semester.
for (const m of marks || []) {
  const semesterId = m.assessments?.semester_id;
  const enrolled = (activeEnrollByStudent.get(m.student_id) || []).some((e) => e.semester_id === semesterId);
  if (!enrolled) {
    const s = (students || []).find((x) => x.id === m.student_id);
    fail.push(`marks ${m.id} for ${s ? label(s) : m.student_id} in semester ${semesterId} with no active enrollment there`);
  }
}

// 4) Two student records sharing one display name. Teacher class lists and the
//    dashboard header show names, so a collision is how attendance/marks get
//    saved against a different students.id than the account being checked.
const byName = new Map();
for (const s of students || []) {
  const name = (s.profiles?.full_name || '').trim().toLowerCase();
  if (!name) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(s);
}
for (const [, group] of byName) {
  if (group.length > 1) {
    const enrolled = group.filter((g) => activeEnrollByStudent.has(g.id)).map((g) => label(g));
    const floating = group.filter((g) => !activeEnrollByStudent.has(g.id)).map((g) => label(g));
    warn.push(
      `"${group[0].profiles?.full_name}" matches ${group.length} student records: ` +
        group.map(label).join(' | ') +
        (enrolled.length && floating.length
          ? ' — a teacher can only pick from ' + enrolled.join(', ') +
            ', so anything saved under that name belongs to that students.id'
          : '')
    );
  }
}

for (const w of warn) console.log(`⚠  ${w}`);
for (const f of fail) console.log(`✗  ${f}`);
console.log('');
if (fail.length === 0) {
  console.log(`✅ Enrollment/record integrity holds (${warn.length} warning(s)).`);
} else {
  console.log(`❌ ${fail.length} integrity problem(s), ${warn.length} warning(s).`);
  process.exitCode = 1;
}
