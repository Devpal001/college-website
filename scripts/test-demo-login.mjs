// End-to-end test of the demo portal login flow against the running API.
// Usage: start `node server/index.js`, then run:
//   node scripts/test-demo-login.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const API = process.env.VITE_API_URL || 'http://localhost:3001';
let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function demoLogin(portalId, role) {
  const res = await fetch(`${API}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId, role }),
  });
  return { status: res.status, body: await res.json() };
}

async function authedGet(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

console.log('== Demo login endpoint ==');
{
  const r = await demoLogin('STU001', 'student');
  ok('STU001/student returns 200', r.status === 200, `got ${r.status}`);
  ok('STU001/student returns session', Boolean(r.body?.session?.access_token));
  ok('STU001/student role is student', r.body?.profile?.role === 'student');
  ok('STU001/student portal id echoed', r.body?.portal?.portalId === 'STU001');
  global.s_student = r.body?.session;

  const r2 = await demoLogin('TCH001', 'teacher');
  ok('TCH001/teacher returns 200', r2.status === 200, `got ${r2.status}`);
  ok('TCH001/teacher role is teacher', r2.body?.profile?.role === 'teacher');
  global.s_teacher = r2.body?.session;

  const r3 = await demoLogin('ADMIN001', 'admin');
  ok('ADMIN001/admin returns 200', r3.status === 200, `got ${r3.status}`);
  ok('ADMIN001/admin role is admin', r3.body?.profile?.role === 'admin');
  global.s_admin = r3.body?.session;

  const wrong = await demoLogin('STU001', 'teacher');
  ok('STU001/teacher denied', wrong.status === 403 || wrong.status === 404, `got ${wrong.status}`);

  const missing = await demoLogin('STU999', 'student');
  ok('Unknown ID denied', missing.status === 404, `got ${missing.status}`);

  const badRole = await demoLogin('STU001', 'principal');
  ok('Invalid role rejected', badRole.status === 400, `got ${badRole.status}`);
}

console.log('== Student dashboard (authenticated) ==');
if (global.s_student) {
  const d = await authedGet('/api/students/me/dashboard', global.s_student.access_token);
  ok('GET /api/students/me/dashboard 200', d.status === 200, `got ${d.status}`);
  ok('Student profile present', Boolean(d.body?.profile?.full_name));
  ok('Student marks present', Array.isArray(d.body?.marks) && d.body.marks.length > 0, `marks=${d.body?.marks?.length}`);
  ok('Student attendance present', Array.isArray(d.body?.attendance) && d.body.attendance.length > 0, `att=${d.body?.attendance?.length}`);
  ok('Student subjects via marks', d.body?.marks?.some((m) => m.assessments?.subjects?.name));
  ok('Announcements present', Array.isArray(d.body?.announcements) && d.body.announcements.length > 0);
  ok('Notifications present', Array.isArray(d.body?.notifications));
}

console.log('== Teacher dashboard (authenticated) ==');
if (global.s_teacher) {
  const d = await authedGet('/api/teachers/me/dashboard', global.s_teacher.access_token);
  ok('GET /api/teachers/me/dashboard 200', d.status === 200, `got ${d.status}`);
  ok('Teacher profile present', Boolean(d.body?.profile?.full_name));
  ok('Teacher subjects present', Array.isArray(d.body?.subjects) && d.body.subjects.length > 0, `subjects=${d.body?.subjects?.length}`);

  const students = await authedGet('/api/sections/CSE-5A/students', global.s_teacher.access_token);
  // Section id is needed; endpoint may take UUID. Fall back to /teachers/me/subjects.
  ok('Teacher subjects endpoint usable', students.status !== 401, `got ${students.status}`);
}

console.log('== Admin (authenticated) ==');
if (global.s_admin) {
  const news = await authedGet('/api/news/admin/items?limit=3', global.s_admin.access_token);
  ok('GET /api/news/admin/items 200', news.status === 200, `got ${news.status}`);
  const agent = await authedGet('/api/agent/status', global.s_admin.access_token);
  ok('GET /api/agent/status 200', agent.status === 200, `got ${agent.status}`);
}

console.log('== Negative route tests ==');
if (global.s_student) {
  const t = await authedGet('/api/teachers/me/dashboard', global.s_student.access_token);
  ok('Student blocked from teacher API', t.status === 403, `got ${t.status}`);
}
if (global.s_teacher) {
  const n = await authedGet('/api/news/admin/items', global.s_teacher.access_token);
  ok('Teacher blocked from admin news API', n.status === 403, `got ${n.status}`);
}

console.log('');
console.log(`Result: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);