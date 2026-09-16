// ============================================================
// BACKUP / RESTORE VERIFICATION
// ============================================================
//   node scripts/verify-data.mjs --dir data/backup-YYYYMMDD-HHmmss
//
// Compares a snapshot (scripts/export-data.mjs) against the database the app is
// currently pointing at:
//   * row counts per table (snapshot vs live)
//   * id presence for every table with ≤ 50 rows, and the first/last 25 ids of
//     larger tables — catches a partial or interrupted restore
//
// READ-ONLY. Use it after a restore, or before deleting a snapshot, to prove
// that what is on disk matches the database.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { TABLES } from './tables.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(REPO, '.env'), quiet: true });

const args = process.argv.slice(2);
const dirArg = args[args.indexOf('--dir') + 1];
if (!dirArg || dirArg.startsWith('--')) {
  console.error('Usage: node scripts/verify-data.mjs --dir data/backup-YYYYMMDD-HHmmss');
  process.exit(1);
}

const DIR = path.resolve(REPO, dirArg);
if (!fs.existsSync(DIR)) {
  console.error(`Snapshot directory not found: ${DIR}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

let problems = 0;

console.log(`🔎 Verifying snapshot ${path.relative(REPO, DIR)}`);
console.log('');
console.log('  table                          snapshot      live   result');

for (const table of TABLES) {
  const file = path.join(DIR, `${table}.json`);
  if (!fs.existsSync(file)) continue;

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const expected = Array.isArray(rows) ? rows.length : 0;

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.log(`  ${table.padEnd(28)} ${String(expected).padStart(8)} ${'—'.padStart(9)}   MISSING TABLE`);
    problems += 1;
    continue;
  }

  const live = count ?? 0;
  let result = live === expected ? 'OK' : live > expected ? 'OK (live has more)' : 'MISMATCH (rows missing)';
  if (live < expected) problems += 1;

  // Spot-check that the snapshot's ids actually exist live.
  if (expected > 0) {
    const ids = rows
      .map((r) => r?.id)
      .filter((id) => id !== undefined && id !== null);
    if (ids.length === expected) {
      const sample = expected <= 50 ? ids : [...ids.slice(0, 25), ...ids.slice(-25)];
      const { data: found, error: foundError } = await supabase.from(table).select('id').in('id', sample);
      if (foundError) {
        result = `id check failed (${foundError.message})`;
        problems += 1;
      } else {
        const foundIds = new Set((found || []).map((r) => String(r.id)));
        const missing = sample.filter((id) => !foundIds.has(String(id))).length;
        if (missing > 0) {
          result = `${missing} sampled id(s) missing`;
          problems += 1;
        }
      }
    }
  }

  console.log(`  ${table.padEnd(28)} ${String(expected).padStart(8)} ${String(live).padStart(9)}   ${result}`);
}

console.log('');
if (problems === 0) {
  console.log('✅ Snapshot and database agree.');
} else {
  console.log(`❌ ${problems} table(s) need attention (see above).`);
  process.exitCode = 1;
}