// Debug: inspect demo-login responses + validate issued tokens.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const API = process.env.VITE_API_URL || 'http://localhost:3001';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function demoLogin(portalId, role) {
  const res = await fetch(`${API}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId, role }),
  });
  let body = null;
  try { body = await res.json(); } catch { body = '(non-json)'; }
  console.log(`\n${portalId}/${role} -> ${res.status}`);
  console.log(JSON.stringify(body, null, 2)?.slice(0, 1200));
  return { res, body };
}

const r1 = await demoLogin('STU001', 'student');
if (r1.body?.session?.access_token) {
  const token = r1.body.session.access_token;
  const { data, error } = await supabase.auth.getUser(token);
  console.log('\ngetUser(token) on STU001 session:', error ? `ERROR ${error.message}` : `OK ${data.user.email}`);
}

await demoLogin('TCH001', 'teacher');
await demoLogin('STU999', 'student');
process.exit(0);