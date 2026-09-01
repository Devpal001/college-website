// ============================================
// MBSCET PORTAL — DEMO DATA SEEDER (development only)
// ============================================
// Idempotent: safe to run again and again. Creates the demo portal
// accounts (STU001 / TCH001 / ADMIN001) plus a consistent set of demo
// academic records (course, semesters, section, subjects, timetable,
// attendance, assessments, marks, announcements, events, notifications).
//
// Run:  node scripts/seed-demo.mjs
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
// in college-website/.env — the same config the API server already uses.
//
// All IDs are deterministic (UUIDv5) so re-runs upsert the same rows.
// Attendance/marks patterns are hash-based (never random) so the demo
// data stays consistent across reloads.
//
// ⚠️ Demo-only data. Do not use in a production database.

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in college-website/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// --------------------------------------------
// Deterministic helpers
// --------------------------------------------

const SEED_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

/** RFC 4122 v5 UUID from a name — stable across runs. */
function uuidV5(name) {
  const nsBytes = Buffer.from(SEED_NAMESPACE.replace(/-/g, ''), 'hex');
  const digest = crypto.createHash('sha1').update(nsBytes).update(name, 'utf8').digest();
  const b = Buffer.from(digest.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic 0..1 hash — used instead of Math.random(). */
function hash01(str) {
  const h = crypto.createHash('md5').update(str).digest();
  return h.readUInt32BE(0) / 0x100000000;
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The last `count` Mon–Sat dates ending yesterday (skips Sundays). */
function lastClassDates(count) {
  const dates = [];
  const d = new Date();
  while (dates.length < count) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0) dates.push(fmtDate(d));
  }
  return dates.reverse();
}

function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return fmtDate(d);
}

function isoAt(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Batched upsert with clear failure messages. */
async function upsertAll(table, rows, onConflict) {
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
  console.log(`   ✓ ${table}: ${rows.length} row(s)`);
}

/** Batched plain insert (used where upsert conflicts must be avoided). */
async function insertAll(table, rows) {
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
  console.log(`   ✓ ${table}: ${rows.length} row(s)`);
}

// --------------------------------------------
// Demo identity definitions
// --------------------------------------------

const DEMO_DOMAIN = 'mbscet.demo';

const DEMO_USERS = [
  { portalId: 'STU001', email: `demo-student@${DEMO_DOMAIN}`, name: 'Demo Student', role: 'student' },
  { portalId: 'STU002', email: `demo-student2@${DEMO_DOMAIN}`, name: 'Aarav Sharma', role: 'student' },
  { portalId: 'STU003', email: `demo-student3@${DEMO_DOMAIN}`, name: 'Priya Verma', role: 'student' },
  { portalId: 'STU004', email: `demo-student4@${DEMO_DOMAIN}`, name: 'Rohan Gupta', role: 'student' },
  { portalId: 'STU005', email: `demo-student5@${DEMO_DOMAIN}`, name: 'Ananya Singh', role: 'student' },
  { portalId: 'TCH001', email: `demo-teacher@${DEMO_DOMAIN}`, name: 'Demo Teacher', role: 'teacher' },
  { portalId: 'TCH002', email: `demo-teacher2@${DEMO_DOMAIN}`, name: 'Meena Rani', role: 'teacher' },
  { portalId: 'ADMIN001', email: `demo-admin@${DEMO_DOMAIN}`, name: 'Demo Administrator', role: 'admin' },
];

async function findAuthUserByEmail(email) {
  let page = 1;
  for (; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureAuthUser(user) {
  const existing = await findAuthUserByEmail(user.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    // Random password — never used by the ID-only demo login flow.
    password: crypto.randomBytes(24).toString('base64url'),
    email_confirm: true,
    options: { data: { full_name: user.name, role: user.role } },
  });
  if (error) {
    const retry = await findAuthUserByEmail(user.email);
    if (retry) return retry;
    throw new Error(`auth user create failed for ${user.email}: ${error.message}`);
  }
  return data.user;
}

async function ensureProfile(user, authUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: authUserId, email: user.email, full_name: user.name, role: user.role, is_active: true },
      { onConflict: 'id' }
    )
    .select()
    .single();
  if (error) throw new Error(`profile upsert failed for ${user.email}: ${error.message}`);
  return data;
}

async function seedIdentities() {
  console.log('1) Demo identities (auth users + profiles)');
  const profilesByPortalId = {};
  for (const user of DEMO_USERS) {
    const authUser = await ensureAuthUser(user);
    const profile = await ensureProfile(user, authUser.id);
    profilesByPortalId[user.portalId] = profile;
    console.log(`   ✓ ${user.portalId} → ${user.name} (${user.role})`);
  }
  return profilesByPortalId;
}

// --------------------------------------------
// Academic structure
// --------------------------------------------

const SUBJECTS = [
  { code: 'CSE501', name: 'Operating Systems', credits: 4, isLab: false, teacher: 'TCH001' },
  { code: 'CSE502', name: 'Database Management Systems', credits: 4, isLab: false, teacher: 'TCH001' },
  { code: 'CSE503', name: 'Computer Networks', credits: 3, isLab: false, teacher: 'TCH001' },
  { code: 'CSE504', name: 'Software Engineering', credits: 3, isLab: false, teacher: 'TCH002' },
  { code: 'CSE505', name: 'Theory of Computation', credits: 4, isLab: false, teacher: 'TCH002' },
  { code: 'CSE551', name: 'Operating Systems Lab', credits: 2, isLab: true, teacher: 'TCH001' },
  { code: 'CSE552', name: 'Database Systems Lab', credits: 2, isLab: true, teacher: 'TCH001' },
];

async function seedAcademicStructure() {
  console.log('2) Academic structure (department, course, semesters, section, subjects, rooms)');

  await upsertAll('departments', [{
    id: uuidV5('department:CSE'),
    name: 'Computer Science Engineering',
    code: 'CSE',
    description: 'Software development, AI/ML, and systems design',
    established_year: 1999,
  }], 'code');

  const { data: cseDept, error: deptErr } = await supabase
    .from('departments').select('*').eq('code', 'CSE').single();
  if (deptErr || !cseDept) throw new Error('CSE department lookup failed: ' + (deptErr?.message || 'not found'));

  const courseId = uuidV5('course:CSE-BTECH');
  await upsertAll('courses', [{
    id: courseId,
    name: 'B.Tech Computer Science & Engineering',
    code: 'CSE-BTECH',
    department_id: cseDept.id,
    duration_years: 4,
    total_semesters: 8,
    description: 'Four year undergraduate programme in Computer Science & Engineering',
  }], 'code');

  await upsertAll('semesters', Array.from({ length: 8 }, (_, i) => ({
    id: uuidV5(`semester:CSE-BTECH:${i + 1}`),
    course_id: courseId,
    semester_number: i + 1,
    name: `Semester ${i + 1}`,
    is_active: true,
  })), 'course_id,semester_number');

  const semester5 = uuidV5('semester:CSE-BTECH:5');
  const section5A = uuidV5('section:CSE-BTECH:5:A');
  await upsertAll('sections', [{
    id: section5A,
    semester_id: semester5,
    name: 'CSE-5A',
    capacity: 60,
  }], 'id');

  await upsertAll('subjects', SUBJECTS.map((s) => ({
    id: uuidV5(`subject:${s.code}`),
    name: s.name,
    code: s.code,
    department_id: cseDept.id,
    credits: s.credits,
    is_lab: s.isLab,
    description: `${s.name} — Fifth semester, B.Tech CSE (demo subject).`,
  })), 'code');

  await upsertAll('rooms', [
    { id: uuidV5('room:L-201'), room_number: 'L-201', building: 'Main Block', capacity: 60, type: 'classroom' },
    { id: uuidV5('room:L-202'), room_number: 'L-202', building: 'Main Block', capacity: 60, type: 'classroom' },
    { id: uuidV5('room:LAB-CS-1'), room_number: 'LAB-CS-1', building: 'Computer Centre', capacity: 40, type: 'lab' },
  ], 'room_number');

  return { cseDeptId: cseDept.id, semester5, section5A };
}

// --------------------------------------------
// People: students, teachers, enrollments, assignments
// --------------------------------------------

const STUDENT_META = {
  STU001: { dob: '2005-03-14', gender: 'male', bloodGroup: 'O+', city: 'Jammu', section: 'A', admission: '2023-08-01' },
  STU002: { dob: '2005-06-02', gender: 'male', bloodGroup: 'A+', city: 'Jammu', section: 'A', admission: '2023-08-01' },
  STU003: { dob: '2005-01-25', gender: 'female', bloodGroup: 'B+', city: 'Udhampur', section: 'A', admission: '2023-08-01' },
  STU004: { dob: '2004-11-08', gender: 'male', bloodGroup: 'AB+', city: 'Kathua', section: 'A', admission: '2023-08-01' },
  STU005: { dob: '2005-04-19', gender: 'female', bloodGroup: 'O-', city: 'Samba', section: 'A', admission: '2023-08-01' },
};

// Deterministic attendance profile per student (share absent / share late).
const ATTENDANCE_PROFILE = {
  STU001: { absent: 0.07, late: 0.07 },
  STU002: { absent: 0.22, late: 0.10 },
  STU003: { absent: 0.03, late: 0.05 },
  STU004: { absent: 0.15, late: 0.10 },
  STU005: { absent: 0.30, late: 0.12 },
};

const CLASS_DAYS = 24; // ~4 weeks of Mon–Sat classes

async function seedPeople(profiles) {
  console.log('3) Students, teachers, enrollments, subject assignments');

  const { data: cseDept } = await supabase.from('departments').select('id').eq('code', 'CSE').single();
  const semester5 = uuidV5('semester:CSE-BTECH:5');
  const section5A = uuidV5('section:CSE-BTECH:5:A');

  const studentRows = DEMO_USERS
    .filter((u) => u.role === 'student')
    .map((u) => {
      const meta = STUDENT_META[u.portalId];
      return {
        id: uuidV5(`student:${u.portalId}`),
        profile_id: profiles[u.portalId].id,
        enrollment_number: u.portalId,
        date_of_birth: meta.dob,
        gender: meta.gender,
        blood_group: meta.bloodGroup,
        city: meta.city,
        state: 'Jammu & Kashmir',
        admission_date: meta.admission,
        current_semester: 5,
        current_section: meta.section,
        department_id: cseDept.id,
      };
    });
  await upsertAll('students', studentRows, 'id');

  const teacherMeta = {
    TCH001: { designation: 'Assistant Professor', qualification: 'M.Tech (CSE)', specialization: 'Operating Systems & Databases', experience: 8, joining: '2018-07-02' },
    TCH002: { designation: 'Associate Professor', qualification: 'Ph.D (CSE)', specialization: 'Software Engineering', experience: 14, joining: '2012-01-16' },
  };
  const teacherRows = DEMO_USERS
    .filter((u) => u.role === 'teacher')
    .map((u) => ({
      id: uuidV5(`teacher:${u.portalId}`),
      profile_id: profiles[u.portalId].id,
      employee_id: u.portalId,
      designation: teacherMeta[u.portalId].designation,
      qualification: teacherMeta[u.portalId].qualification,
      specialization: teacherMeta[u.portalId].specialization,
      experience_years: teacherMeta[u.portalId].experience,
      date_of_joining: teacherMeta[u.portalId].joining,
      department_id: cseDept.id,
    }));
  await upsertAll('teachers', teacherRows, 'id');

  await upsertAll('enrollments', studentRows.map((s) => ({
    id: uuidV5(`enrollment:${s.enrollment_number}:sem5`),
    student_id: s.id,
    semester_id: semester5,
    section_id: section5A,
    status: 'active',
  })), 'student_id,semester_id');

  const teacherSubjectRows = [];
  for (const s of SUBJECTS) {
    teacherSubjectRows.push({
      id: uuidV5(`teacher_subject:${s.teacher}:${s.code}:sem5:A`),
      teacher_id: uuidV5(`teacher:${s.teacher}`),
      subject_id: uuidV5(`subject:${s.code}`),
      semester_id: semester5,
      section_id: section5A,
      assigned_date: '2025-07-01',
      is_active: true,
    });
  }
  await upsertAll('teacher_subjects', teacherSubjectRows,
    'teacher_id,subject_id,semester_id,section_id');

  return { semester5, section5A };
}

// --------------------------------------------
// Weekly timetable for section CSE-5A
// --------------------------------------------

const PERIODS = [
  { start: '09:00', end: '10:00' },
  { start: '10:15', end: '11:15' },
  { start: '11:30', end: '12:30' },
  { start: '14:00', end: '15:00' },
];
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function seedTimetable(sectionId) {
  console.log('4) Weekly timetable (CSE-5A)');

  const { error } = await supabase.from('timetable').delete().eq('section_id', sectionId);
  if (error) throw new Error('timetable reset failed: ' + error.message);

  const rows = [];
  let slot = 0;
  for (const day of WEEK_DAYS) {
    for (const period of PERIODS) {
      const subject = SUBJECTS[slot % SUBJECTS.length];
      rows.push({
        id: uuidV5(`timetable:${sectionId}:${day}:${period.start}`),
        section_id: sectionId,
        subject_id: uuidV5(`subject:${subject.code}`),
        teacher_id: uuidV5(`teacher:${subject.teacher}`),
        room_id: uuidV5(`room:${subject.isLab ? 'LAB-CS-1' : 'L-201'}`),
        day_of_week: day,
        start_time: period.start,
        end_time: period.end,
        semester_id: uuidV5('semester:CSE-BTECH:5'),
        academic_year: '2025-26',
      });
      slot += 1;
    }
  }
  await upsertAll('timetable', rows, 'id');
}

// --------------------------------------------
// Attendance: sessions + per-student records
// --------------------------------------------

// Per-subject fixed period so a subject always has the same class time.
const SUBJECT_SLOT = SUBJECTS.reduce((acc, s, i) => {
  acc[s.code] = PERIODS[i % PERIODS.length];
  return acc;
}, {});

function attendanceStatusFor(enrollment, sessionKey) {
  const profile = ATTENDANCE_PROFILE[enrollment];
  const r = hash01(`attendance:${enrollment}:${sessionKey}`);
  if (r < profile.absent) return 'absent';
  if (r < profile.absent + profile.late) return 'late';
  return 'present';
}

async function seedAttendance(sectionId, profiles) {
  console.log('5) Attendance (sessions + records)');

  // Reset demo rows first (attendance cascades from attendance_sessions via
  // ON DELETE CASCADE). Delete-then-insert is used instead of upsert because
  // the live `attendance` table has a BEFORE UPDATE trigger referencing
  // `updated_at`, which the table lacks — see supabase/migrations/…_fix_attendance_updated_at.sql.
  const { error: delErr } = await supabase
    .from('attendance_sessions')
    .delete()
    .eq('section_id', sectionId);
  if (delErr) throw new Error('attendance_sessions reset failed: ' + delErr.message);

  const studentIds = DEMO_USERS
    .filter((u) => u.role === 'student')
    .map((u) => ({ portalId: u.portalId, id: uuidV5(`student:${u.portalId}`) }));

  const dates = lastClassDates(CLASS_DAYS);
  const sessions = [];
  for (const date of dates) {
    for (const subject of SUBJECTS) {
      const slot = SUBJECT_SLOT[subject.code];
      sessions.push({
        id: uuidV5(`attendance_session:${sectionId}:${subject.code}:${date}`),
        section_id: sectionId,
        subject_id: uuidV5(`subject:${subject.code}`),
        teacher_id: uuidV5(`teacher:${subject.teacher}`),
        date,
        start_time: slot.start,
        end_time: slot.end,
        status: 'completed',
      });
    }
  }
  await insertAll('attendance_sessions', sessions);

  const attendanceRows = [];
  for (const session of sessions) {
    const subject = SUBJECTS.find((s) => uuidV5(`subject:${s.code}`) === session.subject_id);
    for (const student of studentIds) {
      const status = attendanceStatusFor(student.portalId, `${session.subject_id}:${session.date}`);
      attendanceRows.push({
        id: uuidV5(`attendance:${session.id}:${student.id}`),
        session_id: session.id,
        student_id: student.id,
        status,
        marked_by: session.teacher_id,
        marked_at: isoAt(session.date, SUBJECT_SLOT[subject.code].end),
        notes: null,
      });
    }
  }
  await insertAll('attendance', attendanceRows);

  // Log a per-student summary so the demo data is visible in the console.
  for (const student of studentIds) {
    const own = attendanceRows.filter((a) => a.student_id === student.id);
    const present = own.filter((a) => a.status === 'present').length;
    const late = own.filter((a) => a.status === 'late').length;
    const pct = Math.round(((present + late) / own.length) * 100);
    console.log(`   • ${student.portalId}: ${pct}% attendance (${present} present, ${late} late, ${own.length - present - late} absent)`);
  }
  return { sessions };
}

// --------------------------------------------
// Assessments + marks
// --------------------------------------------

const ASSESSMENT_TEMPLATE = (isLab) => (isLab
  ? [{ key: 'practical-1', title: 'Practical 1', type: 'practical', max: 25 }]
  : [
      { key: 'quiz-1', title: 'Quiz 1', type: 'quiz', max: 10 },
      { key: 'assignment-1', title: 'Assignment 1', type: 'assignment', max: 10 },
      { key: 'midterm', title: 'Mid-Term Examination', type: 'midterm', max: 30 },
    ]);

function marksRatioFor(enrollment, subjectCode, assessmentKey) {
  const base = hash01(`marks:${enrollment}:${subjectCode}:${assessmentKey}`);
  // Demo Student performs consistently well; everyone else 55–100%.
  const floor = enrollment === 'STU001' ? 0.68 : 0.55;
  return Math.min(1, floor + (1 - floor) * base);
}

async function seedAssessmentsAndMarks(profiles) {
  console.log('6) Assessments + marks');

  const semester5 = uuidV5('semester:CSE-BTECH:5');
  const studentIds = DEMO_USERS
    .filter((u) => u.role === 'student')
    .map((u) => ({ portalId: u.portalId, id: uuidV5(`student:${u.portalId}`) }));

  const assessments = [];
  for (const subject of SUBJECTS) {
    for (const t of ASSESSMENT_TEMPLATE(subject.isLab)) {
      assessments.push({
        id: uuidV5(`assessment:${subject.code}:${t.key}`),
        subject_id: uuidV5(`subject:${subject.code}`),
        semester_id: semester5,
        title: t.title,
        type: t.type,
        max_marks: t.max,
        weightage: subject.isLab ? 25 : Math.round((t.max / 100) * 100) / 10,
        date_conducted: daysFromToday(-20 + Math.floor(hash01(`when:${subject.code}:${t.key}`) * 14)),
        created_by: uuidV5(`teacher:${subject.teacher}`),
      });
    }
  }
  await upsertAll('assessments', assessments, 'id');

  const marksRows = [];
  for (const assessment of assessments) {
    const subject = SUBJECTS.find((s) => uuidV5(`subject:${s.code}`) === assessment.subject_id);
    for (const student of studentIds) {
      const ratio = marksRatioFor(student.portalId, subject.code, assessment.title);
      const obtained = Math.min(assessment.max_marks, Math.round(assessment.max_marks * ratio * 2) / 2);
      marksRows.push({
        id: uuidV5(`mark:${assessment.id}:${student.id}`),
        assessment_id: assessment.id,
        student_id: student.id,
        marks_obtained: obtained,
        marks_max: assessment.max_marks,
        remarks: null,
        entered_by: uuidV5(`teacher:${subject.teacher}`),
        entered_at: isoAt(daysFromToday(-15), '17:30'),
      });
    }
  }
  await upsertAll('marks', marksRows, 'assessment_id,student_id');

  const stu001 = marksRows.filter((m) => m.student_id === studentIds[0].id);
  const totalObtained = stu001.reduce((sum, m) => sum + m.marks_obtained, 0);
  const totalMax = stu001.reduce((sum, m) => sum + m.marks_max, 0);
  console.log(`   • STU001 aggregate: ${Math.round((totalObtained / totalMax) * 100)}% across ${stu001.length} graded assessments`);
}

// --------------------------------------------
// Announcements + events (visible on dashboards & public pages)
// --------------------------------------------

async function seedAnnouncementsAndEvents(adminProfileId) {
  console.log('7) Announcements + events');

  const { error: annErr } = await supabase
    .from('announcements').delete().like('title', '[DEMO] %');
  if (annErr) throw new Error('announcements reset failed: ' + annErr.message);

  const announcements = [
    {
      title: '[DEMO] Mid-Term Examination Schedule Released',
      content: 'The mid-term examination schedule for all fifth semester B.Tech courses has been published. Examinations begin in two weeks. Check the timetable section of your portal dashboard for subject-wise dates.',
      category: 'exam',
      target_audience: ['all', 'student'],
      priority: 'high',
      published_by: adminProfileId,
      published_at: isoAt(daysFromToday(-6), '10:00'),
      is_active: true,
    },
    {
      title: '[DEMO] DBMS Class Test — Unit 3',
      content: 'A class test covering Unit 3 (SQL and normalization) will be conducted during the regular Database Management Systems lecture this week for section CSE-5A.',
      category: 'academic',
      target_audience: ['student', 'department_CSE', 'semester_5'],
      priority: 'normal',
      published_by: adminProfileId,
      published_at: isoAt(daysFromToday(-4), '09:30'),
      is_active: true,
    },
    {
      title: '[DEMO] Annual Technical Fest — Technovate 2026',
      content: 'Registrations are open for Technovate 2026, the annual technical fest. Events include hackathons, robotics, paper presentations and coding contests. Contact your department coordinator to register.',
      category: 'event',
      target_audience: ['all'],
      priority: 'normal',
      published_by: adminProfileId,
      published_at: isoAt(daysFromToday(-9), '12:00'),
      is_active: true,
    },
    {
      title: '[DEMO] Library Timings Extended During Examinations',
      content: 'The central library will remain open until 20:00 on all working days during the examination period. Students are requested to carry their college ID cards.',
      category: 'general',
      target_audience: ['all', 'student', 'teacher'],
      priority: 'low',
      published_by: adminProfileId,
      published_at: isoAt(daysFromToday(-12), '16:45'),
      is_active: true,
    },
  ];
  await upsertAll('announcements', announcements, 'id');

  const { error: evErr } = await supabase
    .from('events').delete().eq('organizer', 'DEMO_SEED');
  if (evErr) throw new Error('events reset failed: ' + evErr.message);

  const events = [
    {
      id: uuidV5('event:technovate'),
      title: '[DEMO] Technovate 2026 — Annual Technical Fest',
      description: 'Two-day technical fest with hackathon, robotics and coding contests.',
      event_date: daysFromToday(10),
      venue: 'Main Auditorium',
      organizer: 'DEMO_SEED',
      category: 'cultural',
      target_audience: ['all'],
    },
    {
      id: uuidV5('event:placement-week'),
      title: '[DEMO] Campus Placement Drive Week',
      description: 'Multiple companies visiting the campus. Pre-registration required via the Training & Placement Cell.',
      event_date: daysFromToday(18),
      venue: 'Seminar Hall 2',
      organizer: 'DEMO_SEED',
      category: 'seminar',
      target_audience: ['all', 'student'],
    },
    {
      id: uuidV5('event:alumni-session'),
      title: '[DEMO] Alumni Interaction Session',
      description: 'Interactive session with alumni working in leading technology companies.',
      event_date: daysFromToday(25),
      venue: 'Seminar Hall 1',
      organizer: 'DEMO_SEED',
      category: 'academic',
      target_audience: ['all', 'student'],
    },
  ];
  await upsertAll('events', events, 'id');
}

// --------------------------------------------
// Notifications (per demo user)
// --------------------------------------------

async function withNotificationPreference(profileId) {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: profileId,
      college_announcements: true,
      exam_updates: true,
      attendance_alerts: true,
      timetable_changes: true,
      events: true,
      placement_news: true,
      scholarships: true,
      ai_discoveries: true,
    }, { onConflict: 'user_id' });
  if (error) throw new Error('notification_preferences upsert failed: ' + error.message);
}

async function seedNotifications(profiles, attendanceSummary) {
  console.log('8) Notifications + preferences');

  const pool = DEMO_USERS.filter((u) => u.role !== 'admin');
  const rows = [];

  for (const user of pool) {
    const nowMinus = (h) => new Date(Date.now() - h * 3600_000).toISOString();
    const seeded = [
      {
        title: 'Welcome to the MBSCET Portal',
        message: `${user.name}, your ${user.role} portal is ready. Explore your dashboard to view marks, attendance and notices.`,
        type: 'system',
        priority: 'normal',
        createdAt: nowMinus(48),
        read: false,
      },
    ];

    if (user.role === 'student') {
      const summary = attendanceSummary[user.portalId];
      const attendancePct = summary ? Math.round(((summary.present + summary.late) / summary.total) * 100) : null;
      seeded.push(
        {
          title: 'New announcement: Mid-Term Examination Schedule',
          message: 'The mid-term examination schedule for fifth semester has been published. View it under Notices on your dashboard.',
          type: 'exam',
          priority: 'high',
          createdAt: nowMinus(30),
          read: false,
        },
        ...(attendancePct != null && attendancePct < 75
          ? [{ title: 'Low Attendance Alert', message: `Your overall attendance is ${attendancePct}%. Please attend classes regularly to stay above the 75% requirement.`, type: 'attendance', priority: 'high', createdAt: nowMinus(26), read: false }]
          : [{ title: 'Attendance updated', message: 'Your latest attendance records have been updated on your dashboard.', type: 'attendance', priority: 'normal', createdAt: nowMinus(20), read: false }]),
        {
          title: 'Mid-Term marks published',
          message: 'Mid-term examination marks for Operating Systems and Database Management Systems have been published. Check your Marks tab.',
          type: 'marks',
          priority: 'normal',
          createdAt: nowMinus(14),
          read: false,
        }
      );
    } else if (user.role === 'teacher') {
      seeded.push({
        title: 'New teacher announcement: Exam duty roster',
        message: 'The examination duty roster for the upcoming mid-term exams has been released. Please check your schedule.',
        type: 'announcement',
        priority: 'normal',
        createdAt: nowMinus(28),
        read: false,
      });
    }

    for (const n of seeded) {
      rows.push({
        user_id: profiles[user.portalId].id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        status: 'sent',
        read: false,
        read_at: null,
        created_at: n.createdAt,
        sent_at: n.createdAt,
        data: null,
      });
    }
    await withNotificationPreference(profiles[user.portalId].id);
  }

  // Remove previously seeded demo notifications first (keep it idempotent).
  const demoEmails = DEMO_USERS.map((u) => u.email);
  const { data: demoProfiles } = await supabase.from('profiles').select('id').in('email', demoEmails);
  if (demoProfiles?.length) {
    const { error: delErr } = await supabase
      .from('notifications').delete().in('user_id', demoProfiles.map((p) => p.id));
    if (delErr) throw new Error('notifications cleanup failed: ' + delErr.message);
  }

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw new Error('notifications insert failed: ' + error.message);
  console.log(`   ✓ notifications: ${rows.length} row(s)`);
}

// --------------------------------------------
// Main
// --------------------------------------------

async function main() {
  const startedAt = Date.now();
  console.log('');
  console.log('🔄 MBSCET Portal — demo data seeder');
  console.log('-----------------------------------');

  try {
    const profiles = await seedIdentities();

    await seedAcademicStructure();
    const sec5A = uuidV5('section:CSE-BTECH:5:A');

    await seedPeople(profiles);

    await seedTimetable(sec5A);

    await seedAttendance(sec5A, profiles);

    await seedAssessmentsAndMarks(profiles);

    await seedAnnouncementsAndEvents(profiles['ADMIN001'].id);

    // Build attendance summary for notifications.
    const summary = {};
    for (const user of DEMO_USERS.filter((u) => u.role === 'student')) {
      const sid = uuidV5(`student:${user.portalId}`);
      const { data } = await supabase
        .from('attendance').select('status').eq('student_id', sid);
      const present = data.filter((a) => a.status === 'present').length;
      const late = data.filter((a) => a.status === 'late').length;
      summary[user.portalId] = { present, late, total: data.length };
    }

    await seedNotifications(profiles, summary);

    // Link the CSE department HOD to the demo teacher (nice-to-have, no FK conflict).
    const { error: hodErr } = await supabase
      .from('departments')
      .update({ hod_id: uuidV5('teacher:TCH001') })
      .eq('id', uuidV5('department:CSE'));
    if (hodErr) console.warn('   ⚠ (optional) HOD link skipped:', hodErr.message);

    // Print the onboarding guide.
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log('');
    console.log('✅ Seeding complete in ' + elapsed + 's');
    console.log('');
    console.log('Demo login (Student/Teacher/Admin portal):');
    console.log('   Student → STU001   (Demo Student)');
    console.log('   Teacher → TCH001   (Demo Teacher)');
    console.log('   Admin   → ADMIN001 (Demo Administrator)');
    console.log('   Teacher roster also includes: TCH002, STU002–STU005');
    console.log('');
    console.log('   Admin IDs are mapped to auth emails via .env:');
    console.log('   DEMO_ADMIN_IDS="ADMIN001=demo-admin@mbscet.demo"');
  } catch (err) {
    console.error('');
    console.error('❌ Seeding failed:', err.message);
    process.exitCode = 1;
  }
}

main();






