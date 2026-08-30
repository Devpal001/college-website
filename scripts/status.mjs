// ============================================
// STACK STATUS CHECK — college-website
// Run:  npm run status     (or:  node scripts/status.mjs)
// Zero dependencies — uses the built-in fetch (Node 18+).
//
// Checks:
//   1. Backend API  (http://localhost:3001/health)
//   2. AI assistant route  (401 without a token = alive & guarded)
//   3. Frontend dev server  (Vite, ports 5173-5175)
// ============================================

const API_PORT = process.env.PORT || 3001;
const WEB_PORTS = [5173, 5174, 5175]; // Vite hops to the next port when one is busy

const results = [];

async function probe(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), ...options });
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    return { ok: true, status: res.status, ms: Date.now() - started, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      body: err?.cause?.code || err?.message || 'unreachable',
    };
  }
}

function report(label, url, probeResult, verdict) {
  results.push({ label, url, ...probeResult, verdict });
}

// 1) Backend API health
const health = await probe(`http://localhost:${API_PORT}/health`);
report(
  'Backend API server',
  `http://localhost:${API_PORT}/health`,
  health,
  health.ok && health.status === 200
    ? 'RUNNING'
    : 'NOT RUNNING'
);

// 2) AI assistant route — a POST without a token must get 401.
//    401 means: server up, route mounted, auth guard active.
//    Anything else (404 / connection refused) means trouble.
const chat = await probe(`http://localhost:${API_PORT}/api/assistant/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'ping' }),
});
report(
  'AI assistant endpoint',
  `POST http://localhost:${API_PORT}/api/assistant/chat`,
  chat,
  chat.status === 401
    ? 'RUNNING (auth guard active — normal without login)'
    : chat.ok || chat.status === 400
      ? 'RUNNING'
      : 'NOT RUNNING / NOT MOUNTED'
);

// 3) Frontend dev server (first responsive Vite port wins)
let web = null;
let webUrl = null;
for (const port of WEB_PORTS) {
  const r = await probe(`http://localhost:${port}/`);
  if (r.ok && r.status === 200) { web = r; webUrl = `http://localhost:${port}/`; break; }
}
report(
  'Frontend dev server (Vite)',
  webUrl || `http://localhost:${WEB_PORTS[0]}/`,
  web || { ok: false, status: 0, ms: 0, body: 'no response on ports 5173-5175' },
  web ? 'RUNNING' : 'NOT RUNNING'
);

// ============================================
// PRINT
// ============================================
const mark = (up) => (up ? '✅ UP  ' : '❌ DOWN');
const line = '─'.repeat(66);

console.log('\n🔍 College Website — Stack Status');
console.log(`   ${new Date().toLocaleString()}`);
console.log(line);
for (const r of results) {
  const up = r.verdict.startsWith('RUNNING');
  console.log(`${mark(up)} ${r.label}`);
  console.log(`        ${r.url}`);
  console.log(`        → HTTP ${r.status || '—'} (${r.ms} ms) ${up ? '' : `— ${r.body}`}`);
}
console.log(line);

const backendUp = results[0].verdict === 'RUNNING';
const webUp = results[2].verdict === 'RUNNING';

if (backendUp && webUp) {
  console.log('🎉 Everything is running. The AI assistant should work on the site.');
} else {
  console.log('🛠  How to fix:');
  if (!backendUp) console.log('   • Start the stack from the college-website folder:  npm run dev');
  if (!webUp) console.log('   • Frontend is down — run:  npm run dev  (or restart Vite)');
  console.log('   • Re-check afterwards with:  npm run status');
}
console.log('');
