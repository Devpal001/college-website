// ============================================================
// AUTH-CHUNK SPLIT GUARD (BRAIN.md §21) — source level, no build needed.
// ------------------------------------------------------------
// The Supabase SDK is 203 KB raw / ~52 KB gzipped and is only needed to sign
// in, so it lives in src/lib/supabaseClient.js behind the dynamic import in
// src/lib/supabase.js. A single static `import { supabase }` anywhere in src/
// pulls the whole SDK back into the entry chunk and every signed-out visitor
// pays for it again — which is exactly what this check prevents.
// Run: node scripts/test-auth-bundle-split.mjs
// ============================================================
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

async function* sourceFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.jsx?$/.test(entry.name)) yield path;
  }
}

const rel = (file) => relative(SRC, file).split(sep).join('/');

const importers = { sdk: [], chunk: [] };
for await (const file of sourceFiles(SRC)) {
  const source = await readFile(file, 'utf8');
  if (/from\s+['"]@supabase\/supabase-js['"]/.test(source)) importers.sdk.push(rel(file));
  if (/['"]\.\/supabaseClient(\.js)?['"]/.test(source)) importers.chunk.push(rel(file));
}

const loaderSource = await readFile(join(SRC, 'lib', 'supabase.js'), 'utf8');
const LOADER_LABEL = 'lib/supabase.js';
const CLIENT_LABEL = 'lib/supabaseClient.js';

const checks = [
  [
    'only lib/supabaseClient.js imports @supabase/supabase-js',
    importers.sdk.length === 1 && importers.sdk[0] === CLIENT_LABEL,
    importers.sdk.join(', ') || 'none',
  ],
  [
    'only lib/supabase.js imports the heavy client',
    importers.chunk.length === 1 && importers.chunk[0] === LOADER_LABEL,
    importers.chunk.join(', ') || 'none',
  ],
  ['loader exposes getSupabase()', /export function getSupabase\(/.test(loaderSource), ''],
  ['loader exposes hasStoredSession()', /export function hasStoredSession\(/.test(loaderSource), ''],
  [
    'loader loads the client through import(), not a static import',
    /import\(['"]\.\/supabaseClient(\.js)?['"]\)/.test(loaderSource),
    '',
  ],
];

let failed = 0;
for (const [label, passed, detail] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}${!passed && detail ? ` — found ${detail}` : ''}`);
  if (!passed) failed += 1;
}

if (failed > 0) {
  console.error(
    '\nMove the import behind getSupabase() (see src/lib/supabase.js) — a static\n' +
      'import puts ~52 KB gzipped of Supabase SDK back into the initial chunk.'
  );
  process.exitCode = 1;
}
