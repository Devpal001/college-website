// Focused regression check for the institutional-login client boundary.
// This is deliberately source-level: it runs without credentials or a live
// database and protects the invariant that issuing a user session never
// mutates the shared service-role database client.

import { readFile } from 'node:fs/promises';

const authRouteUrl = new URL('../server/routes/auth.js', import.meta.url);
const source = await readFile(authRouteUrl, 'utf8');

const checks = [
  [
    'dedicated session-auth client factory exists',
    /function createSessionAuthClient\(\)\s*\{[\s\S]*?return createClient\(/.test(source),
  ],
  [
    'institutional login creates a request-scoped client',
    /const sessionClient = createSessionAuthClient\(\);[\s\S]{0,400}?sessionClient\.auth\.signInWithPassword\(\{ email, password \}\)/.test(source),
  ],
  [
    'institutional login does not sign in on the shared database client',
    !/supabase\.auth\.signInWithPassword\(/.test(source),
  ],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`);
  if (!passed) failed += 1;
}

if (failed > 0) process.exitCode = 1;
