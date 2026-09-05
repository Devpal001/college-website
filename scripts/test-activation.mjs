// ============================================================
// MBSCET PORTAL — PHASE 1 ACTIVATION FLOW E2E TEST (self-cleaning)
// ============================================================
// Exercises the college identity registry + account activation flow:
//   admin registry -> activation matrix -> DB verification -> cleanup.
//
// PREREQUISITES:
//   1. The Phase 1 migration (2026_09_05_phase1_account_activations.sql)
//      must be applied.
//   2. The dev server must be running:   npm run dev
//   3. Demo identities must be seeded:   node scripts/seed-demo.mjs
//      (the script signs in as ADMIN001 via the demo login, which is only
//       available outside production NODE_ENV).
//
// The script creates ONE clearly-named TEST identity
// (institutional ID TEST-ACT-STU, email test-activation@mbscet.demo),
// runs the assertions, and DELETES it afterwards — the auth-user delete
// cascades through profiles, the students row and the activation record,
// so no fake data remains.
//
// Run:  node scripts/test-activation.mjs
//       TEST_BASE_URL=http://localhost:5173 node scripts/test-activation.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const TEST_INSTITUTIONAL_ID = 'TEST-ACT-STU';
const TEST_EMAIL = 'test-activation@mbscet.demo';
const TEST_PASSWORD = 'Act1vat3!TestPW';
const GENERIC = 'ACTIVATION_FAILED';

let passed = 0;
let failed = 0;
function ok(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body: json };
}

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// The activation endpoint is IP-rate-limited (10/min). Pace the activation
// attempts so a single test run stays comfortably inside the window and
// consecutive re-runs are not wrongly rejected by the limiter.
const delay = (ms = 7000) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup() {
  // Removing the auth user cascades profile -> students -> activation row.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => (u.email || '').toLowerCase() === TEST_EMAIL);
    if (user) {
      await service.auth.admin.deleteUser(user.id);
      console.log('  ✓ cleanup: test identity deleted (cascades profile + role row + activation)');
      return;
    }
    if (data.users.length < 200) break;
  }
}

async function main() {
  console.log('');
  console.log('🔄 Phase 1 activation flow — E2E test (self-cleaning)');
  console.log('-----------------------------------------------------');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL / service key in college-website/.env');
    process.exitCode = 1;
    return;
  }

  // 0) Remove leftovers from a previous run.
  await cleanup();

  // 1) Admin session through the dev-only demo login.
  const login = await api('/api/auth/demo-login', {
    method: 'POST',
    body: { portalId: 'ADMIN001', role: 'admin' },
  });
  ok('admin demo sign-in (dev only)', login.status === 200 && !!login.body?.session?.access_token, `status ${login.status}`);
  const adminToken = login.body?.session?.access_token;

  // 2) Registry: create the TEST pending identity.
  const reg = await api('/api/users/registry', {
    method: 'POST',
    token: adminToken,
    body: {
      institutionalId: TEST_INSTITUTIONAL_ID,
      email: TEST_EMAIL,
      fullName: 'Activation Test',
      role: 'student',
    },
  });
  ok('registry: pending student identity created (201)', reg.status === 201, `status ${reg.status} ${JSON.stringify(reg.body)}`);
  const code = reg.body?.data?.activationCode;
  ok('registry: one-time activation code issued', typeof code === 'string' && code.length >= 8);
  ok('registry: account status is pending', reg.body?.data?.status === 'pending');
  ok('registry: role comes from the registry entry (student)', reg.body?.data?.role === 'student');

  // DEBUG: does the activation row exist right after registry?
  const { data: actRowsAfterReg } = await service
    .from('account_activations')
    .select('id, profile_id, used_at');
  console.log('  [debug] account_activations rows AFTER registry:', JSON.stringify(actRowsAfterReg));

  // 3) Wrong institutional email -> generic denial.
  const wrongEmail = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID, email: 'wrong@mbscet.demo', activationCode: code, password: TEST_PASSWORD },
  });
  ok('activation: wrong institutional email denied (generic)', wrongEmail.status === 400 && wrongEmail.body?.code === GENERIC, `status ${wrongEmail.status}`);
  await delay();

  // 4) Wrong code -> generic denial.
  const badCode = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID, email: TEST_EMAIL, activationCode: 'AAAA-BBBB-CCCC-DDDD', password: TEST_PASSWORD },
  });
  ok('activation: wrong code denied (generic)', badCode.status === 400 && badCode.body?.code === GENERIC, `status ${badCode.status}`);
  await delay();

  // 5) Unknown institutional ID -> identical generic denial (no enumeration).
  const unknownId = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: 'TEST-DOES-NOT-EXIST', email: TEST_EMAIL, activationCode: code, password: TEST_PASSWORD },
  });
  ok('activation: unknown institutional ID denied (no enumeration)', unknownId.status === 400 && unknownId.body?.code === GENERIC, `status ${unknownId.status}`);
  await delay();

  // 6) Weak password -> specific policy rejection.
  const weak = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID, email: TEST_EMAIL, activationCode: code, password: 'weakpass' },
  });
  ok('activation: weak password rejected by policy', weak.status === 400 && weak.body?.code === 'INVALID_PASSWORD', `status ${weak.status}`);
  await delay();

  // 7) Valid activation — lowercase ID + dash-formatted code prove normalization.
  const activationCode = code || '';
  const prettyCode = activationCode.replace(/(.{4})(?=.)/g, '$1-');
  const act = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID.toLowerCase(), email: TEST_EMAIL, activationCode: prettyCode, password: TEST_PASSWORD },
  });
  ok('activation: valid activation succeeds', act.status === 200 && act.body?.data?.activated === true, `status ${act.status} ${JSON.stringify(act.body)}`);
  ok('activation: authoritative role returned (student)', act.body?.data?.role === 'student');
  await delay();

  // 8) Code is single-use.
  const reuse = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID, email: TEST_EMAIL, activationCode: code, password: `${TEST_PASSWORD}!` },
  });
  ok('activation: code is single-use (reuse denied)', reuse.status === 400 && reuse.body?.code === GENERIC, `status ${reuse.status}`);
  await delay();

  // 9) Already-active account denied generically.
  const again = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID, email: TEST_EMAIL, activationCode: code, password: TEST_PASSWORD },
  });
  ok('activation: already-active account denied (generic)', again.status === 400 && again.body?.code === GENERIC, `status ${again.status}`);
  await delay();

  // 10) Legacy email/password login works after activation (Decision 5).
  const legacy = await service.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  ok('legacy email/password login works after activation', !!legacy.data?.session, legacy.error?.message || '');

  // 11) DB verification: linkage + authoritative role + burned code.
  const { data: profile } = await service
    .from('profiles')
    .select('id, role, status, is_active, institutional_id')
    .eq('institutional_id', TEST_INSTITUTIONAL_ID)
    .maybeSingle();
  ok('db: profile active + institutional_id set', profile?.status === 'active' && profile?.is_active === true && profile?.institutional_id === TEST_INSTITUTIONAL_ID, JSON.stringify(profile));
  ok('db: authoritative role is student', profile?.role === 'student');
  const { data: studentRow } = await service
    .from('students')
    .select('id, enrollment_number')
    .eq('profile_id', profile?.id)
    .maybeSingle();
  ok('db: student record linked (enrollment = institutional ID)', !!studentRow && studentRow.enrollment_number === TEST_INSTITUTIONAL_ID, JSON.stringify(studentRow));
  const { data: activationRow } = await service
    .from('account_activations')
    .select('id, profile_id, used_at, code_hash')
    .eq('profile_id', profile?.id)
    .maybeSingle();
  console.log('  [debug] activationRow for profile', profile?.id, '=>', JSON.stringify(activationRow || 'NO ROW'));
  console.log('  [debug] profile.id from lookup:', profile?.id);
  console.log('  [debug] reg.body.data.id (registry) :', reg?.body?.data?.id);
  const { data: allRows } = await service.from('account_activations').select('id, profile_id, used_at');
  console.log('  [debug] account_activations rows during run:', JSON.stringify(allRows));
  ok('db: activation code burned', !!activationRow?.used_at);

  // 12) RLS: deny-by-default for anonymous clients; service role has access.
  const svcRead = await service.from('account_activations').select('*');
  ok('security: service role can read account_activations', !svcRead.error && Array.isArray(svcRead.data), svcRead.error?.message || '');
  if (ANON_KEY) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: anonRows } = await anon.from('account_activations').select('*');
    ok('security: anon client cannot read account_activations (RLS deny-by-default)', Array.isArray(anonRows) && anonRows.length === 0, JSON.stringify(anonRows));
  } else {
    console.log('  ⚠ skipped anon RLS probe (VITE_SUPABASE_ANON_KEY not set)');
  }

  // 13) Suspended accounts cannot be (re)activated.
  await service.from('profiles').update({ status: 'suspended' }).eq('id', profile.id);
  await delay();
  const suspended = await api('/api/auth/activate', {
    method: 'POST',
    body: { institutionalId: TEST_INSTITUTIONAL_ID, email: TEST_EMAIL, activationCode: code, password: TEST_PASSWORD },
  });
  ok('activation: suspended account denied (generic)', suspended.status === 400 && suspended.body?.code === GENERIC, `status ${suspended.status}`);
}

async function run() {
  try {
    await main();
  } finally {
    try {
      await cleanup();
    } catch (e) {
      console.log(`  ⚠ cleanup failed: ${e.message} — remove ${TEST_EMAIL} manually`);
    }
  }
  console.log('');
  console.log(`Phase 1 activation test: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

run();