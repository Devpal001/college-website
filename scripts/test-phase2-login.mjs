// MBSCET PORTAL - PHASE 2 INSTITUTIONAL LOGIN E2E TEST (self-cleaning)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const TEST_PASSWORD = 'T3st!PassPhr';
const WRONG_PASSWORD = 'Wr0ng!PassX';

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { passed += 1; console.log('  OK ' + label); }
  else { failed += 1; console.log('  FAIL ' + label + (detail ? ' -- ' + detail : '')); }
}

async function api(p, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE_URL + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, body: json };
}

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function setPassword(id, pw) { await service.auth.admin.updateUserById(id, { password: pw }); }
async function getProfile(id) {
  const { data } = await service.from('profiles').select('id, email, role, status, institutional_id').eq('institutional_id', id).maybeSingle();
  return data;
}

async function cleanup() {
  for (const id of ['STU001', 'TCH001', 'ADMIN001']) {
    const p = await getProfile(id);
    if (p) await setPassword(p.id, TEST_PASSWORD);
  }
  const { data: tp } = await service.from('profiles').select('id').ilike('institutional_id', 'TEST-P2-%');
  if (tp && tp.length) { for (const p of tp) { await service.auth.admin.deleteUser(p.id); } }
}

async function main() {
  console.log('');
  console.log('Phase 2 institutional login - E2E test (self-cleaning)');
  console.log('-----------------------------------------------------');

  const student = await getProfile('STU001');
  const teacher = await getProfile('TCH001');
  const admin = await getProfile('ADMIN001');
  ok('setup: STU001 exists', !!student);
  ok('setup: TCH001 exists', !!teacher);
  ok('setup: ADMIN001 exists', !!admin);
  if (student) await setPassword(student.id, TEST_PASSWORD);
  if (teacher) await setPassword(teacher.id, TEST_PASSWORD);
  if (admin) await setPassword(admin.id, TEST_PASSWORD);

  console.log('');
  console.log('  [Test 1] Valid active student login');
  const t1 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD, portal: 'student' } });
  ok('1a. HTTP 200', t1.status === 200, 'status ' + t1.status);
  ok('1b. Session issued', !!t1.body?.session);
  ok('1c. Student role', t1.body?.profile?.role === 'student');
  ok('1d. Portal role', t1.body?.portal?.role === 'student');

  console.log('');
  console.log('  [Test 2] Wrong portal selection');
  const t2 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD, portal: 'teacher' } });
  ok('2a. HTTP 403', t2.status === 403, 'status ' + t2.status);
  ok('2b. PORTAL_MISMATCH', t2.body?.code === 'PORTAL_MISMATCH');
  ok('2c. No session', !t2.body?.session);

  console.log('');
  console.log('  [Test 3] Wrong password');
  const t3 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: WRONG_PASSWORD, portal: 'student' } });
  ok('3a. HTTP 400', t3.status === 400, 'status ' + t3.status);
  ok('3b. LOGIN_FAILED', t3.body?.code === 'LOGIN_FAILED');
  ok('3c. No session', !t3.body?.session);

  console.log('');
  console.log('  [Test 4] Unknown institutional ID');
  const t4 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'UNKNOWN999', password: TEST_PASSWORD, portal: 'student' } });
  ok('4a. HTTP 400', t4.status === 400, 'status ' + t4.status);
  ok('4b. LOGIN_FAILED', t4.body?.code === 'LOGIN_FAILED');
  ok('4c. No session', !t4.body?.session);

  console.log('');
  console.log('  [Test 5] Pending account');
  const pendId = 'TEST-P2-PEND';
  const pendEmail = 'test-p2-pend@mbscet.demo';
  const { data: pendUser } = await service.auth.admin.createUser({ email: pendEmail, password: TEST_PASSWORD, email_confirm: true });
  if (pendUser?.user) {
    await service.from('profiles').insert({ id: pendUser.user.id, institutional_id: pendId, email: pendEmail, full_name: 'Test Pending', role: 'student', status: 'pending', is_active: false });
    const t5 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: pendId, password: TEST_PASSWORD, portal: 'student' } });
    ok('5a. HTTP 400', t5.status === 400, 'status ' + t5.status);
    ok('5b. LOGIN_FAILED', t5.body?.code === 'LOGIN_FAILED');
    ok('5c. No session', !t5.body?.session);
  }

  console.log('');
  console.log('  [Test 6] Suspended account');
  if (student) {
    await service.from('profiles').update({ status: 'suspended' }).eq('id', student.id);
    const t6 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD, portal: 'student' } });
    ok('6a. HTTP 400', t6.status === 400, 'status ' + t6.status);
    ok('6b. LOGIN_FAILED', t6.body?.code === 'LOGIN_FAILED');
    ok('6c. No session', !t6.body?.session);
    await service.from('profiles').update({ status: 'active' }).eq('id', student.id);
  }

  console.log('');
  console.log('  [Test 7] Disabled account');
  if (teacher) {
    await service.from('profiles').update({ status: 'disabled' }).eq('id', teacher.id);
    const t7 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'TCH001', password: TEST_PASSWORD, portal: 'teacher' } });
    ok('7a. HTTP 400', t7.status === 400, 'status ' + t7.status);
    ok('7b. LOGIN_FAILED', t7.body?.code === 'LOGIN_FAILED');
    ok('7c. No session', !t7.body?.session);
    await service.from('profiles').update({ status: 'active' }).eq('id', teacher.id);
  }

  console.log('');
  console.log('  [Test 8] Authoritative role from database');
  const t8a = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD, portal: 'admin' } });
  ok('8a. Student cannot be admin (403)', t8a.status === 403, 'status ' + t8a.status);
  ok('8b. PORTAL_MISMATCH', t8a.body?.code === 'PORTAL_MISMATCH');
  const t8b = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD } });
  ok('8c. No portal succeeds', t8b.status === 200, 'status ' + t8b.status);
  ok('8d. Role still student', t8b.body?.profile?.role === 'student');

  console.log('');
  console.log('  [Test 9] Legacy email/password login');
  if (student) {
    const t9 = await service.auth.signInWithPassword({ email: student.email, password: TEST_PASSWORD });
    ok('9a. Email login succeeds', !!t9.data?.session, t9.error?.message || '');
    await service.auth.signOut();
  }

  console.log('');
  console.log('  [Test 10] Development demo-login');
  const t10 = await api('/api/auth/demo-login', { method: 'POST', body: { portalId: 'STU001', role: 'student' } });
  ok('10a. Demo login works', t10.status === 200, 'status ' + t10.status);
  ok('10b. Session issued', !!t10.body?.session);
  ok('10c. Student role', t10.body?.profile?.role === 'student');

  console.log('');
  console.log('  [Test 11] Login creates no records');
  const bProf = await service.from('profiles').select('id').eq('institutional_id', 'STU001');
  const bStud = await service.from('students').select('id').eq('enrollment_number', 'STU001');
  const bTeach = await service.from('teachers').select('id').eq('employee_id', 'STU001');
  await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD, portal: 'student' } });
  const aProf = await service.from('profiles').select('id').eq('institutional_id', 'STU001');
  const aStud = await service.from('students').select('id').eq('enrollment_number', 'STU001');
  const aTeach = await service.from('teachers').select('id').eq('employee_id', 'STU001');
  ok('11a. No new profiles', bProf.data?.length === aProf.data?.length);
  ok('11b. No new students', bStud.data?.length === aStud.data?.length);
  ok('11c. No new teachers', bTeach.data?.length === aTeach.data?.length);

  console.log('');
  console.log('  [Test 12] No service-role credential leaked');
  const t12 = await api('/api/auth/login', { method: 'POST', body: { institutionalId: 'STU001', password: TEST_PASSWORD, portal: 'student' } });
  const respStr = JSON.stringify(t12.body);
  ok('12a. No service key', !respStr.includes('sb_secret_'));
  ok('12b. No service_role', !respStr.includes('service_role'));
  ok('12c. Tokens returned', !!t12.body?.session?.access_token && !!t12.body?.session?.refresh_token);

  console.log('');
  console.log('  [Test 13] Session authorization flow');
  if (t12.body?.session) {
    const token = t12.body.session.access_token;
    const t13a = await api('/api/users/me', { token });
    ok('13a. Token valid for /me', t13a.status === 200, 'status ' + t13a.status);
    ok('13b. Correct role', t13a.body?.data?.role === 'student');
    const t13b = await api('/api/users/admin', { token });
    ok('13c. Student cannot access admin', t13b.status === 403, 'status ' + t13b.status);
  }
}

async function run() {
  try { await main(); }
  finally {
    try { await cleanup(); console.log(''); console.log('  cleanup complete'); }
    catch (e) { console.log(''); console.log('  cleanup failed: ' + e.message); }
  }
  console.log('');
  console.log('Phase 2 login test: ' + passed + ' passed, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
}

run();
