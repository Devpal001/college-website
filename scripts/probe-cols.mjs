// Introspect live table columns for the seed-relevant tables.
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

const tables = ['attendance', 'attendance_sessions', 'events', 'announcements', 'notifications', 'marks', 'assessments', 'students', 'teachers', 'profiles'];
for (const t of tables) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', t);
  if (error) {
    console.log(`${t}: introspection failed — ${error.message}`);
    continue;
  }
  console.log(`${t}: ${data.map((c) => c.column_name).join(', ')}`);
}
process.exit(0);