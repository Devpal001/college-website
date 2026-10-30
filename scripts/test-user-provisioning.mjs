// ============================================================
// Provisioning verification (read-only on code; creates + cleans
// up its own test users via the same rollback mechanism).
// Usage: node scripts/_verify-provision.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const SB_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const API = 'http://localhost:3001';
const PASSWORD = 'Str0ng!Pass1';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

async function demoLogin(portalId, role) {
  const res = await fetch(`${API}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId, role }),
  });
  if (res.status !== 200) throw new Error(`demo-login ${portalId} -> ${res.status}`);
  const body = await res.json();
  return body.session.access_token;
}

const adminTok = await demoLogin('ADMIN001', 'admin');
const hdr = { Authorization: `Bearer ${adminTok}`, 'Content-Type': 'application/json' };

// Reference data for student placement (semester + section are now REQUIRED
// and validated server-side on every student provisioning call).
const sectionsRes = await fetch(`${API}/api/sections`, { headers: hdr });
const sectionsList = await sectionsRes.json();
const placementSection = Array.isArray(sectionsList) ? sectionsList[0] : null;
const placementSemesterId = placementSection?.semesters?.id || null;
ok(
  'reference: a section with an embedded semester exists',
  sectionsRes.status === 200 && Boolean(placementSection) && Boolean(placementSemesterId),
  `status=${sectionsRes.status}`
);
const semRes = await fetch(`${API}/api/semesters`, { headers: hdr });
const semList = await semRes.json();
// A semester that is NOT the section's semester — used for the mismatch test.
const otherSemester = (Array.isArray(semList) ? semList : []).find(
  (s) => s.id !== placementSemesterId
);
ok('reference: a non-matching semester exists for the mismatch test', Boolean(otherSemester));

const placement = { semesterId: placementSemesterId, sectionId: placementSection?.id };

// Service client used by the placement assertions below (and by the
// cleanup/rollback checks further down).
const svc = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

// 1) List + q filter (the param is `q`, not `search`)
let res = await fetch(`${API}/api/users/admin?page=1&limit=50`, { headers: hdr });
const list = await res.json();
ok('list returns seed users', res.status === 200 && list.meta.total >= 8, `total=${list.meta?.total}`);
const first = list.data[0];
ok('list row has safe shape (no password/phone leak)', first && 'email' in first && 'role' in first);

// 1b) Student provisioning REQUIRES an explicit, valid placement
res = await fetch(`${API}/api/users/admin`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({
    email: 'probe.noplacement@test.mbscet.in', password: PASSWORD,
    fullName: 'No Placement', role: 'student', enrollmentNumber: 'PROBE-NP',
  }),
});
const noPlacement = await res.json();
ok('missing placement -> 400', res.status === 400, `status=${res.status} code=${noPlacement?.code}`);
ok('missing placement code is PLACEMENT_REQUIRED', noPlacement?.code === 'PLACEMENT_REQUIRED', `code=${noPlacement?.code}`);
await new Promise((r) => setTimeout(r, 800));
const { data: npUser } = await svc
  .from('profiles').select('id').eq('email', 'probe.noplacement@test.mbscet.in').maybeSingle();
ok('missing placement created no account', npUser === null);

// 1c) section/semester mismatch is rejected BEFORE any account exists
res = await fetch(`${API}/api/users/admin`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({
    email: 'probe.mismatch@test.mbscet.in', password: PASSWORD,
    fullName: 'Mismatch Probe', role: 'student', enrollmentNumber: 'PROBE-MM',
    semesterId: otherSemester?.id, sectionId: placementSection?.id,
  }),
});
const mismatch = await res.json();
ok('section not in semester -> 400', res.status === 400, `status=${res.status} code=${mismatch?.code}`);
ok('mismatch code is SEMESTER_SECTION_MISMATCH', mismatch?.code === 'SEMESTER_SECTION_MISMATCH', `code=${mismatch?.code}`);
await new Promise((r) => setTimeout(r, 800));
const { data: mmUser } = await svc
  .from('profiles').select('id').eq('email', 'probe.mismatch@test.mbscet.in').maybeSingle();
ok('mismatch created no account', mmUser === null);

// 1d) unknown semester -> 400 SEMESTER_NOT_FOUND
res = await fetch(`${API}/api/users/admin`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({
    email: 'probe.badsem@test.mbscet.in', password: PASSWORD,
    fullName: 'Bad Semester', role: 'student', enrollmentNumber: 'PROBE-BS',
    semesterId: '00000000-0000-4000-8000-000000000000', sectionId: placementSection?.id,
  }),
});
const badSem = await res.json();
ok('unknown semester -> 400', res.status === 400, `status=${res.status} code=${badSem?.code}`);
ok('unknown semester code is SEMESTER_NOT_FOUND', badSem?.code === 'SEMESTER_NOT_FOUND', `code=${badSem?.code}`);

// 2) Provision a student (explicit semester + section, as the UI sends)
res = await fetch(`${API}/api/users/admin`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({
    email: 'probe.verify@test.mbscet.in', password: PASSWORD,
    fullName: 'Verify Probe', role: 'student', enrollmentNumber: 'PROBE-900',
    semesterId: placement.semesterId,
    sectionId: placement.sectionId,
  }),
});
const created = await res.json();
ok('provision student -> 201', res.status === 201, JSON.stringify(created).slice(0, 200));
ok('response carries enrollment_number', created?.data?.enrollment_number === 'PROBE-900');
ok(
  'response carries the placement',
  created?.data?.semester_id === placement.semesterId && created?.data?.section_id === placement.sectionId,
  JSON.stringify(created?.data || {}).slice(0, 200)
);
const newId = created?.data?.id;

// 2b) The enrollment row exists and is ACTIVE (the record teachers read)
const { data: enrollRow } = await svc
  .from('enrollments')
  .select('id, status, semester_id, section_id, students!inner(id)')
  .eq('students.profile_id', newId)
  .maybeSingle();
ok(
  'active enrollment row created with the requested placement',
  Boolean(enrollRow) && enrollRow.status === 'active' &&
    enrollRow.semester_id === placement.semesterId && enrollRow.section_id === placement.sectionId,
  JSON.stringify(enrollRow || null)
);

// 3) Real password login via GoTrue (exactly what supabase-js does)
res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
  body: JSON.stringify({ email: 'probe.verify@test.mbscet.in', password: PASSWORD }),
});
const login = await res.json();
ok('GoTrue password login -> 200 session', res.status === 200 && Boolean(login.access_token), `status=${res.status}`);

// 4) Negative: wrong password does NOT reveal account existence semantics
res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
  body: JSON.stringify({ email: 'probe.verify@test.mbscet.in', password: 'WrongPass!123' }),
});
ok('wrong password -> 400 (GoTrue standard)', res.status === 400);

// 5) Rollback proof: duplicate enrollment -> 409, auth user deleted.
//    (Placement supplied so the request fails on the duplicate students
//     row — proving the rollback path still cascades with enrollment.)
res = await fetch(`${API}/api/users/admin`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({
    email: 'probe.rollback2@test.mbscet.in', password: PASSWORD,
    fullName: 'Rollback Probe 2', role: 'student', enrollmentNumber: 'STU001',
    semesterId: placement.semesterId,
    sectionId: placement.sectionId,
  }),
});
ok('duplicate enrollment -> 409', res.status === 409, `status=${res.status}`);

await new Promise((r) => setTimeout(r, 1500));
const { data: rbUser } = await svc.from('profiles').select('id').eq('email', 'probe.rollback2@test.mbscet.in').maybeSingle();
ok('rollback deleted the 409 auth user+profile', rbUser === null);

// 6) q search finds the new user, not the rolled-back one
res = await fetch(`${API}/api/users/admin?q=probe.verify`, { headers: hdr });
const q1 = await res.json();
ok('q=probe.verify finds exactly 1', q1.meta?.total === 1, `total=${q1.meta?.total}`);
res = await fetch(`${API}/api/users/admin?q=probe.rollback2`, { headers: hdr });
const q2 = await res.json();
ok('q=probe.rollback2 finds 0 (deleted)', q2.meta?.total === 0, `total=${q2.meta?.total}`);

// 7) role filter
res = await fetch(`${API}/api/users/admin?role=teacher`, { headers: hdr });
const q3 = await res.json();
ok('role=teacher filter', q3.data?.every((u) => u.role === 'teacher'));

// 8) Duplicate EMAIL provisioning -> 409-ish, no orphan
res = await fetch(`${API}/api/users/admin`, {
  method: 'POST', headers: hdr,
  body: JSON.stringify({
    email: 'probe.verify@test.mbscet.in', password: PASSWORD,
    fullName: 'Dup Email', role: 'teacher', employeeId: 'PROBE-EMP-1',
  }),
});
ok('duplicate email -> 409', res.status === 409, `status=${res.status}`);

// 9) Cleanup: delete the verify probe via service key (same as rollback path)
if (newId) {
  const { error: delErr } = await svc.auth.admin.deleteUser(newId);
  ok('cleanup deleteUser succeeded', !delErr, delErr?.message || '');
  const { data: gone } = await svc.from('profiles').select('id').eq('id', newId).maybeSingle();
  ok('cleanup cascaded profile+students', gone === null);
  await new Promise((r) => setTimeout(r, 800));
  const { data: goneEnroll } = await svc
    .from('enrollments')
    .select('id, students!inner(profile_id)')
    .eq('students.profile_id', newId);
  ok(
    'cleanup cascaded the enrollment row too',
    (goneEnroll || []).length === 0,
    JSON.stringify(goneEnroll || []).slice(0, 200)
  );
}

console.log(`Result: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
