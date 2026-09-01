// Test a single login as the FIRST request against a fresh server.
const which = process.argv[2] || 'TCH001';
const role = process.argv[3] || 'teacher';
const API = process.env.VITE_API_URL || 'http://localhost:3001';
const res = await fetch(`${API}/api/auth/demo-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ portalId: which, role }),
});
let body = null;
try { body = await res.json(); } catch { body = '(non-json)'; }
console.log(`${which}/${role} -> ${res.status}`);
console.log(JSON.stringify(body)?.slice(0, 500));
process.exit(0);