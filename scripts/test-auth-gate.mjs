// ============================================================
// PHASE 2 AUTH GATE TESTS — fail-closed demo-login enforcement
// ------------------------------------------------------------
// Spawns the real server (server/index.js) in three configurations
// and asserts the demo-login endpoint respects the gate:
//   A. DISABLE_DEMO_LOGIN=true, NODE_ENV=production  -> 404 (kill switch)
//   B. NODE_ENV=production, no demo flags            -> 404 (fail-closed)
//   C. DEMO_LOGIN_ENABLED=true, NODE_ENV=production  -> 200 (explicit opt-in)
// Plus a sanity 401 on a protected endpoint with no token in mode A.
//
// Requires the local .env (Supabase creds) and the seeded demo users.
// Usage: node scripts/test-auth-gate.mjs
// ============================================================
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer({ port, extraEnv }) {
  const env = { ...process.env, PORT: String(port), ...extraEnv };
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));

  // Wait for /health (max ~30s for cold start + Supabase connect).
  const base = `http://localhost:${port}`;
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) {
        healthy = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return { child, base, healthy, logs };
}

async function stopServer(child) {
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
    setTimeout(resolve, 3000); // safety fallback
  });
}

async function demoLogin(base) {
  const res = await fetch(`${base}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId: 'STU001', role: 'student' }),
  });
  return { status: res.status, body: await res.json() };
}

console.log('== A) DISABLE_DEMO_LOGIN=true (production) — expect demo-login 404 ==');
{
  const s = await startServer({ port: 3191, extraEnv: { DISABLE_DEMO_LOGIN: 'true', NODE_ENV: 'production' } });
  if (!s.healthy) {
    ok('server A boots (health)', false, s.logs.slice(-400));
  } else {
    ok('server A boots (health)', true);
    const r = await demoLogin(s.base);
    ok('A: demo-login 404 when DISABLE_DEMO_LOGIN=true', r.status === 404, `got ${r.status}`);

    // Sanity: protected endpoint still enforces auth.
    const protectedRes = await fetch(`${s.base}/api/students/me/dashboard`);
    ok('A: protected endpoint returns 401 with no token', protectedRes.status === 401, `got ${protectedRes.status}`);
  }
  await stopServer(s.child);
}

console.log('== B) NODE_ENV=production, NO demo flags — expect demo-login 404 (fail-closed) ==');
{
  const s = await startServer({ port: 3192, extraEnv: { NODE_ENV: 'production' } });
  if (!s.healthy) {
    ok('server B boots (health)', false, s.logs.slice(-400));
  } else {
    ok('server B boots (health)', true);
    const r = await demoLogin(s.base);
    ok('B: demo-login 404 in production by default (fail-closed)', r.status === 404, `got ${r.status}`);
  }
  await stopServer(s.child);
}

console.log('== C) DEMO_LOGIN_ENABLED=true (production) — expect demo-login 200 (explicit opt-in) ==');
{
  const s = await startServer({ port: 3193, extraEnv: { DEMO_LOGIN_ENABLED: 'true', NODE_ENV: 'production' } });
  if (!s.healthy) {
    ok('server C boots (health)', false, s.logs.slice(-400));
  } else {
    ok('server C boots (health)', true);
    const r = await demoLogin(s.base);
    ok('C: demo-login 200 when DEMO_LOGIN_ENABLED=true', r.status === 200, `got ${r.status}`);
    if (r.status === 200) {
      ok('C: returns a real session', Boolean(r.body?.session?.access_token));
    }
  }
  await stopServer(s.child);
}

console.log(`Result: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);