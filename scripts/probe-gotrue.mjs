// Reproduce: does a generateLink+verifyOtp call change query behavior?
import { supabase } from '../server/lib/db.js';

async function probe(label, fn) {
  try {
    const { data, error } = await fn();
    console.log(`${label}: ${error ? `ERROR ${error.message}` : 'OK'}`);
  } catch (e) {
    console.log(`${label}: THREW ${e.message}`);
  }
}

// 1. Baseline queries BEFORE any GoTrue admin call.
await probe('BEFORE teachers TCH001', () =>
  supabase.from('teachers').select('*, profiles(*)').eq('employee_id', 'TCH001').maybeSingle());
await probe('BEFORE profiles admin by email', () =>
  supabase.from('profiles').select('*').eq('email', 'demo-admin@mbscet.demo').maybeSingle());

// 2. Do the session issuance sequence.
const link = await supabase.auth.admin.generateLink({ type: 'magiclink', email: 'demo-student@mbscet.demo' });
console.log('generateLink:', link.error ? `ERR ${link.error.message}` : 'OK');
if (link.data?.properties?.hashed_token) {
  const otp = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
  console.log('verifyOtp:', otp.error ? `ERR ${otp.error.message}` : 'OK');
} else {
  console.log('verifyOtp: skipped (no hashed token)', JSON.stringify(link.data)?.slice(0, 200));
}

// 3. Re-run the same queries AFTER.
await probe('AFTER teachers TCH001', () =>
  supabase.from('teachers').select('*, profiles(*)').eq('employee_id', 'TCH001').maybeSingle());
await probe('AFTER profiles admin by email', () =>
  supabase.from('profiles').select('*').eq('email', 'demo-admin@mbscet.demo').maybeSingle());
process.exit(0);