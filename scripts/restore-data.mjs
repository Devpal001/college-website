// ============================================================
// PORTABLE DATA RESTORE (from a scripts/export-data.mjs snapshot)
// ============================================================
//   node scripts/restore-data.mjs --dir data/backup-XXX              (DRY RUN)
//   node scripts/restore-data.mjs --dir data/backup-XXX --confirm    (writes)
//   node scripts/restore-data.mjs --dir data/backup-XXX --confirm --tables profiles,students
//
// SAFETY MODEL — read before changing anything here:
//   * DRY RUN by default: without --confirm nothing is written.
//   * Upsert only. This script NEVER deletes rows, so a wrong snapshot cannot
//     destroy live data. (A full, exact clone is done with pg_restore — see
//     docs/BACKUP_MIGRATION.md.)
//   * Tables are written in parent-before-child order (scripts/tables.mjs) so
//     foreign keys resolve.
//   * Tables whose rows have no single-column `id` are reported and skipped
//     instead of being written blindly.
//   * Every write is followed by a row-count check against the snapshot.
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
const flag = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
};

const CONFIRM = args.includes('--confirm');
const dirArg = flag('--dir');
const only = (flag('--tables') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const BATCH_SIZE = Number(flag('--batch') || 500);

if (!dirArg) {
  console.error('Usage: node scripts/restore-data.mjs --dir data/backup-YYYYMMDD-HHmmss [--confirm] [--tables a,b]');
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

const manifestPath = path.join(DIR, 'manifest.json');
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : null;

if (manifest) {
  console.log(`📂 Snapshot from ${manifest.exportedAt} (source: ${manifest.source})`);
}
console.log(CONFIRM ? '⚠️  CONFIRM mode — rows will be written (upsert, never delete).' : '🔍 DRY RUN — no changes will be written. Add --confirm to restore.');

const order = TABLES.filter((t) => (only.length ? only.includes(t) : true));
const skippedNoId = [];
const written = [];
const failed = [];
let totalRows = 0;

for (const table of order) {
  const file = path.join(DIR, `${table}.json`);
  if (!fs.existsSync(file)) continue;

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`   – ${table}: nothing to restore`);
    continue;
  }

  const hasSingleId = rows.every((row) => row && row.id !== undefined && row.id !== null);
  if (!hasSingleId) {
    skippedNoId.push(table);
    console.log(`   ! ${table}: ${rows.length} row(s) — no single-column id; use pg_restore for this table`);
    continue;
  }

  if (!CONFIRM) {
    console.log(`   • ${table}: would upsert ${rows.length} row(s) on id`);
    totalRows += rows.length;
    continue;
  }

  let tableFailed = false;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      failed.push(`${table}: ${error.message}`);
      console.error(`    ${table}: ${error.message}`);
      tableFailed = true;
      break;
    }
  }
  if (tableFailed) continue;

  const { count, error: countError } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (countError) {
    console.log(`   ✓ ${table}: ${rows.length} row(s) upserted (count check failed: ${countError.message})`);
  } else {
    console.log(`   ✓ ${table}: ${rows.length} row(s) upserted — table now holds ${count}`);
  }
  written.push(table);
  totalRows += rows.length;
}

console.log('');
if (CONFIRM) {
  console.log(`✅ Restore finished — ${totalRows} row(s) upserted across ${written.length} table(s).`);
} else {
  console.log(`✅ Dry run finished — ${totalRows} row(s) would be upserted.`);
}
if (skippedNoId.length) console.log(`   Skipped (composite key): ${skippedNoId.join(', ')}`);
if (failed.length) {
  console.log(`    ${failed.length} table(s) failed:`);
  for (const f of failed) console.log(`      - ${f}`);
  process.exitCode = 1;
}
console.log('   Reminder: verify with scripts/verify-data.mjs after restoring.');