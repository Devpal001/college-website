// Pinpoint which nested-profile queries trigger RLS recursion.
import { supabase } from '../server/lib/db.js';

async function probe(label, fn) {
  try {
    const { data, error } = await fn();
    console.log(`${label}: ${error ? `ERROR ${error.message}` : `OK rows=${(data?.length ?? 1)}`}`);
  } catch (e) {
    console.log(`${label}: THREW ${e.message}`);
  }
}

await probe('students STU001 (*, profiles(*))', () =>
  supabase.from('students').select('*, profiles(*)').eq('enrollment_number', 'STU001').maybeSingle());
await probe('students STU999 (*, profiles(*))', () =>
  supabase.from('students').select('*, profiles(*)').eq('enrollment_number', 'STU999').maybeSingle());
await probe('students STU001 plain', () =>
  supabase.from('students').select('*').eq('enrollment_number', 'STU001').maybeSingle());
await probe('teachers TCH001 (*, profiles(*))', () =>
  supabase.from('teachers').select('*, profiles(*)').eq('employee_id', 'TCH001').maybeSingle());
await probe('teachers TCH001 plain', () =>
  supabase.from('teachers').select('*').eq('employee_id', 'TCH001').maybeSingle());
await probe('profiles by email (demo-student)', () =>
  supabase.from('profiles').select('*').eq('email', 'demo-student@mbscet.demo').maybeSingle());
await probe('profiles by email (demo-teacher)', () =>
  supabase.from('profiles').select('*').eq('email', 'demo-teacher@mbscet.demo').maybeSingle());
process.exit(0);