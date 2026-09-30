#!/usr/bin/env node
// ============================================================
// PRODUCTION BUILD ENTRY POINT  (used by `npm run build`)
// ------------------------------------------------------------
// `vite build` picks its whole production behaviour — react/jsx-runtime vs
// react/jsx-dev-runtime, React's dev vs prod build, minification, and
// `import.meta.env.PROD` — from `process.env.NODE_ENV`, and Vite reads that
// value while resolving env files, BEFORE the Vite config runs.
//
// Two things therefore silently produced a DEVELOPMENT bundle for this repo:
//   1. `.env` (gitignored, local) containing `NODE_ENV=development` — Vite
//      copies it into process.env when NODE_ENV was not already set.
//   2. CI (`.github/workflows/ci.yml`) exporting `NODE_ENV=test`.
// Measured effect: 684 KB unminified initial chunk with react/jsx-dev-runtime
// instead of 229 KB minified.
//
// Setting NODE_ENV here — in the parent process, before Vite is imported —
// is the one place that reliably wins: Vite then treats NODE_ENV as
// user-provided (`isNodeEnvSet`) and ignores the value from `.env`.
//
// Output is identical to `vite build` (same config file, same `dist/`).
// ============================================================
process.env.NODE_ENV = 'production';

const { build } = await import('vite');

try {
  await build({ configFile: 'vite.config.js' });
} catch (error) {
  console.error(error);
  process.exit(1);
}
