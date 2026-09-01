// Temporary DB probe — checks which portal tables exist in the live project.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TABLES = [
  'profiles', 'students', 'teachers', 'departments', 'courses', 'semesters',
  'sections', 'subjects', 'enrollments', 'teacher_subjects', 'timetable',
  'attendance_sessions', 'attendance', 'assessments', 'marks',
  'announcements', 'events', 'notifications', 'news_sources', 'news_items',
  'rooms', 'audit_logs',
];

for (const t of TABLES) {
  const { error, count } = await supabase.from(t).select('id', { count: 'exact', head: true });
  console.log(`${error ? 'MISSING/ERR' : 'OK'} ${t} ${error ? '→ ' + error.message : '→ rows: ' + count}`);
}

// Auth users overview
const { data: users } = await supabase.auth.admin.listUsers({ perPage: 200 });
console.log('auth users:', users.users.length);
for (const u of users.users) {
  console.log('  ', u.email);
}
process.exit(0);
