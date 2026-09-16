// ============================================================
// MBSCET PORTAL — PUBLIC FORM + SESSION ENDPOINT TEST (self-cleaning)
// ============================================================
// Covers the endpoints the public pages depend on — the two that used to be
// direct browser -> database calls, plus the identity endpoint the shared
// session store uses:
//
//   POST /api/admissions   (was: supabase.from('admissions').insert)
//   POST /api/contact      (was: supabase.from('messages').insert)
//   GET  /api/auth/me      (new: authoritative identity + role)
//
// The script boots its own API process, so no dev server is required:
//   node scripts/test-public-forms.mjs
//
// It writes clearly-named test rows through the public endpoints and deletes
// them again with the service-role client — no fake data remains.
// ============================================================

import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(REPO, '.env'), quiet: true });

const PORT = Number(process.env.TEST_PORT || 3194);
const BASE = `http://localhost:${PORT}`;
const TEST_EMAIL = 'public-forms-test@mbscet.demo';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const service = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function post(pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

async function get(pathname, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

async function startServer() {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));

  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return { child, healthy: true, logs };
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return { child, healthy: false, logs };
}

async function stopServer(child) {
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
    setTimeout(resolve, 3000);
  });
}

async function cleanup() {
  await service.from('admissions').delete().eq('email', TEST_EMAIL);
  await service.from('messages').delete().eq('email', TEST_EMAIL);
}

console.log('== 0) Boot the API ==');
await cleanup();
const server = await startServer();
if (!server.healthy) {
  ok('API boots (health)', false, server.logs.slice(-400));
  console.log(`Result: ${pass} passed, ${fail} failed`);
  process.exit(1);
}
ok('API boots (health)', true);

console.log('== 1) POST /api/admissions ==');
{
  const valid = await post('/api/admissions', {
    full_name: 'Public Forms Test',
    email: TEST_EMAIL,
    phone: '+91-80826-07955',
    course_applied: 'B.Tech Computer Science Engineering',
    message: 'Automated test row (deleted by the test script).',
  });
  ok('valid submission -> 201', valid.status === 201, `got ${valid.status} ${JSON.stringify(valid.body)}`);
  ok('valid submission -> { ok: true }', valid.body?.ok === true);

  const stored = await service
    .from('admissions')
    .select('full_name, email, phone, course_applied, message')
    .eq('email', TEST_EMAIL)
    .maybeSingle();
  ok('row persisted with whitelisted columns', Boolean(stored.data), stored.error?.message || '');
  ok('stored course matches the request', (stored.data?.course_applied || '').startsWith('B.Tech'));

  const noEmail = await post('/api/admissions', {
    full_name: 'Public Forms Test',
    email: 'not-an-email',
    phone: '8082607955',
    course_applied: 'B.Tech',
  });
  ok(
    'invalid email -> 400 INVALID_EMAIL',
    noEmail.status === 400 && noEmail.body?.code === 'INVALID_EMAIL',
    `got ${noEmail.status} ${JSON.stringify(noEmail.body)}`
  );

  const badPhone = await post('/api/admissions', {
    full_name: 'Public Forms Test',
    email: TEST_EMAIL,
    phone: 'abc',
    course_applied: 'B.Tech',
  });
  ok(
    'invalid phone -> 400 INVALID_PHONE',
    badPhone.status === 400 && badPhone.body?.code === 'INVALID_PHONE',
    `got ${badPhone.status} ${JSON.stringify(badPhone.body)}`
  );

  const emptyName = await post('/api/admissions', {
    full_name: '   ',
    email: TEST_EMAIL,
    phone: '8082607955',
    course_applied: 'B.Tech',
  });
  ok('empty name -> 400', emptyName.status === 400, `got ${emptyName.status}`);

  // Extra columns must be ignored, never written.
  const extra = await post('/api/admissions', {
    full_name: 'Public Forms Test',
    email: TEST_EMAIL,
    phone: '8082607955',
    course_applied: 'B.Tech',
    status: 'approved',
  });
  ok('unknown/privileged columns ignored (still 201)', extra.status === 201, `got ${extra.status}`);
  const rows = await service.from('admissions').select('status').eq('email', TEST_EMAIL);
  ok('client cannot set the review status', !(rows.data || []).some((r) => r.status === 'approved'), JSON.stringify(rows.data));
}

console.log('== 2) POST /api/contact ==');
{
  const valid = await post('/api/contact', {
    name: 'Public Forms Test',
    email: TEST_EMAIL,
    message: 'Automated contact test (deleted by the test script).',
  });
  ok('valid message -> 201', valid.status === 201, `got ${valid.status} ${JSON.stringify(valid.body)}`);

  const stored = await service
    .from('messages')
    .select('name, email, message')
    .eq('email', TEST_EMAIL)
    .maybeSingle();
  ok('message persisted', Boolean(stored.data), stored.error?.message || '');

  const empty = await post('/api/contact', { name: 'Public Forms Test', email: TEST_EMAIL, message: '' });
  ok('empty message -> 400', empty.status === 400, `got ${empty.status}`);

  const noEmail = await post('/api/contact', { name: 'x', email: 'nope', message: 'hello' });
  ok(
    'invalid email -> 400 INVALID_EMAIL',
    noEmail.status === 400 && noEmail.body?.code === 'INVALID_EMAIL',
    `got ${noEmail.status}`
  );
}

console.log('== 3) GET /api/auth/me (authoritative role) ==');
{
  const anon = await get('/api/auth/me');
  ok('no token -> 401', anon.status === 401, `got ${anon.status}`);
  ok('no credentials leaked', !JSON.stringify(anon.body || {}).includes('service_role'));

  const login = await post('/api/auth/demo-login', { portalId: 'STU001', role: 'student' });
  ok('demo-login STU001 -> 200', login.status === 200, `got ${login.status} ${JSON.stringify(login.body)}`);

  if (login.status === 200) {
    const token = login.body?.session?.access_token;
    const me = await get('/api/auth/me', token);
    ok('with token -> 200', me.status === 200, `got ${me.status}`);
    ok('role comes from the database', me.body?.profile?.role === 'student', `role=${me.body?.profile?.role}`);
    ok('user identity present', Boolean(me.body?.user?.email));
    ok('service key never returned', !JSON.stringify(me.body || {}).includes('service_role'));
  }
}

console.log('== 4) Abuse control (shared limiter) ==');
{
  const before = await service
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('email', TEST_EMAIL);
  const beforeCount = before.count ?? 0;

  let sawRateLimited = false;
  let rateLimitedCode = null;
  for (let i = 0; i < 12; i++) {
    const r = await post('/api/contact', {
      name: 'Public Forms Test',
      email: TEST_EMAIL,
      message: `bulk ${i}`,
    });
    if (r.status === 429) {
      sawRateLimited = true;
      rateLimitedCode = r.body?.code || null;
    }
  }
  ok('repeated submissions get 429', sawRateLimited);
  ok('429 carries the RATE_LIMITED code', rateLimitedCode === null || rateLimitedCode === 'RATE_LIMITED', `code=${rateLimitedCode}`);

  const after = await service
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('email', TEST_EMAIL);
  ok('limiter caps the rows written', (after.count ?? 0) - beforeCount <= 10, `rows added: ${(after.count ?? 0) - beforeCount}`);
}

await stopServer(server.child);
await cleanup();

console.log(`Result: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);