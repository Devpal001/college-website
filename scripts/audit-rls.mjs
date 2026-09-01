// ============================================
// RLS AUDIT PROBE (Phase 4) — READ-ONLY
// ============================================
// Establishes the live Row-Level-Security state of the Supabase database:
//   1. Live column discovery for key tables (service-role client).
//   2. Per-role access matrix: anon / student / teacher / admin vs the
//      service-role row count, classified as FULL / PARTIAL / DENIED /
//      RECURSION_ERROR / ERROR.
//   3. The Phase 4 attack scenarios (student A reads student B, etc.).
//
// This script NEVER writes to the database. Usage:
//   node scripts/audit-rls.mjs
// ============================================

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const API = process.env.VITE_API_URL || 'http://localhost:3001';

const service = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function demoLogin(portalId, role) {
  const res = await fetch(`${API}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId, role }),
  });
  if (!res.ok) throw new Error(`demo-login ${portalId} failed: ${res.status}`);
  return (await res.json()).session;
}

async function clientFor(session) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
  return c;
}

// ---------- 1) live column discovery ----------
console.log('== 1) LIVE SCHEMA (service-role, actual columns) ==');
const liveTables = [
  'profiles', 'students', 'enrollments', 'teacher_subjects', 'announcements',
  'events', 'notifications', 'notification_preferences', 'news_items',
  'news_sources', 'admissions', 'audit_logs',
];
const liveColumns = {};
for (const t of liveTables) {
  const { data, error } = await service.from(t).select('*').limit(1);
  if (error) {
    console.log(`  ${t}: ERROR ${error.message}`);
    liveColumns[t] = null;
  } else {
    liveColumns[t] = data[0] ? Object.keys(data[0]) : [];
    console.log(`  ${t}: ${liveColumns[t].length} cols -> ${liveColumns[t].join(', ')}`);
  }
}

// ---------- 2) role clients ----------
const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
const studentSession = await demoLogin('STU001', 'student');
const teacherSession = await demoLogin('TCH001', 'teacher');
const adminSession = await demoLogin('ADMIN001', 'admin');
const studentClient = await clientFor(studentSession);
const teacherClient = await clientFor(teacherSession);
const adminClient = await clientFor(adminSession);

const roles = [
  ['anon', anonClient],
  ['student', studentClient],
  ['teacher', teacherClient],
  ['admin', adminClient],
  ['service', service],
];

// ---------- 3) access matrix ----------
const matrixTables = [
  'profiles', 'students', 'teachers', 'departments', 'announcements', 'events',
  'enrollments', 'timetable', 'attendance', 'marks', 'notifications',
  'notification_preferences', 'news_items', 'news_sources', 'admissions',
  'audit_logs', 'ai_agent_runs', 'teacher_subjects', 'sections',
];

async function probeCount(client, table) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    if (/infinite recursion/i.test(error.message)) return { cls: 'RECURSION', detail: error.message.slice(0, 80) };
    return { cls: 'ERROR', detail: error.message.slice(0, 80) };
  }
  return { cls: 'OK', count: count ?? 0 };
}

console.log('');
console.log('== 2) RLS ACCESS MATRIX (row counts per role; service = ground truth) ==');
const pad = (s, w) => String(s).padEnd(w);
console.log(pad('table', 26) + roles.map(([r]) => pad(r, 22)).join(''));
for (const t of matrixTables) {
  let row = pad(t, 26);
  for (const [r, client] of roles) {
    const res = await probeCount(client, t);
    const cell = res.cls === 'OK' ? String(res.count) : `${res.cls}:${(res.detail || '').slice(0, 18)}`;
    row += pad(cell, 22);
  }
  console.log(row);
}
// ---------- 4) attack scenarios ----------
console.log('');
console.log('== 3) ATTACK SCENARIOS ==');
const studentUserId = studentSession.profile.id;

const { data: ownStudent } = await service
  .from('students')
  .select('id, enrollment_number')
  .eq('profile_id', studentUserId)
  .single();
console.log('student under test: ' + (ownStudent ? ownStudent.enrollment_number : 'n/a'));

const { data: otherStudents } = await service
  .from('students')
  .select('id, enrollment_number, profile_id')
  .neq('profile_id', studentUserId)
  .limit(1);
const other = otherStudents && otherStudents[0];

if (other) {
  const { count: otherRowCount } = await studentClient
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('id', other.id);
  console.log('S1 student -> other student row: ' + (otherRowCount > 0 ? 'LEAKED' : 'blocked') + ' (' + otherRowCount + ')');

  const { count: otherMarks } = await studentClient
    .from('marks')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', other.id);
  console.log('S2 student -> other student marks: ' + (otherMarks > 0 ? 'LEAKED' : 'blocked') + ' (' + otherMarks + ')');

  const { data: otherNotifs } = await studentClient
    .from('notifications')
    .select('*')
    .eq('user_id', other.profile_id)
    .limit(1);
  console.log('S3 student -> other user notifications: ' + (otherNotifs && otherNotifs.length > 0 ? 'LEAKED' : 'blocked'));
} else {
  console.log('S1-S3 skipped: only one student exists in the database');
}

{
  const { count: totalMarks } = await service.from('marks').select('*', { count: 'exact', head: true });
  const { count: teacherMarks } = await teacherClient.from('marks').select('*', { count: 'exact', head: true });
  console.log('S4 teacher -> marks visibility: ' + teacherMarks + '/' + totalMarks + ' (should be a subset)');
}

console.log('');
console.log('== probe complete (read-only; nothing was written) ==');
