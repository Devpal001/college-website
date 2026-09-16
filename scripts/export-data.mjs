// ============================================================
// PORTABLE DATA EXPORT (logical backup)
// ============================================================
// Writes every table to JSON under data/backup-<timestamp>/, so the college's
// data can be backed up, transferred and re-verified without depending on
// pg_dump being installed on the machine running it.
//
//   node scripts/export-data.mjs                     -> data/backup-YYYYMMDD-HHmmss/
//   node scripts/export-data.mjs --out data/mysnap   -> custom directory
//
// READ-ONLY: this script never writes to the database.
// It uses the service-role key from .env (server-side only). The key is never
// printed, logged or written into the snapshot.
//
// For a byte-exact, schema-inclusive backup use pg_dump instead — see
// docs/BACKUP_MIGRATION.md. This JSON export is the provider-independent
// fallback and the format used to verify a restore.
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(' SUPABASE_URL / service-role key missing in .env — cannot export.');
  process.exit(1);
}

const PAGE_SIZE = 1000;
const outFlagIndex = process.argv.indexOf('--out');
const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const OUT_DIR = path.resolve(
  REPO,
  outFlagIndex > -1 && process.argv[outFlagIndex + 1]
    ? process.argv[outFlagIndex + 1]
    : path.join('data', `backup-${stamp}`)
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Reads all rows of a table, paging past the PostgREST 1000-row cap. */
async function readAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** PostgREST reports a missing table with this code — a snapshot may skip it. */
function isMissingTable(error) {
  const code = error?.code || '';
  const message = error?.message || '';
  return code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(message);
}

console.log(`📦 Exporting to ${path.relative(REPO, OUT_DIR)}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = {
  exportedAt: new Date().toISOString(),
  source: SUPABASE_URL,
  format: 'json-per-table (arrays of rows, bigint/uuid ids preserved as text)',
  restore: 'node scripts/restore-data.mjs --dir <this folder> --confirm',
  tables: {},
};

const skipped = [];
let totalRows = 0;

for (const table of TABLES) {
  try {
    const rows = await readAll(table);
    fs.writeFileSync(
      path.join(OUT_DIR, `${table}.json`),
      JSON.stringify(rows, null, 2),
      'utf8'
    );
    manifest.tables[table] = { rows: rows.length };
    totalRows += rows.length;
    console.log(`   ✓ ${table}: ${rows.length} row(s)`);
  } catch (error) {
    if (isMissingTable(error)) {
      skipped.push(table);
      console.log(`   – ${table}: not present in this database (skipped)`);
      continue;
    }
    console.error(`    ${table}: ${error.message}`);
    process.exitCode = 1;
  }
}

manifest.totalRows = totalRows;
manifest.skippedTables = skipped;
fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('');
console.log(`✅ Export complete — ${totalRows} row(s) across ${Object.keys(manifest.tables).length} table(s).`);
if (skipped.length) console.log(`   Skipped (absent): ${skipped.join(', ')}`);
console.log(`   Manifest: ${path.relative(REPO, path.join(OUT_DIR, 'manifest.json'))}`);
console.log('   ⚠️  This snapshot contains real user data. Keep it out of git (data/ is ignored).');