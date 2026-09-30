import process from 'node:process';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ============================================================
// PRODUCTION BUILD NOTE (see scripts/build.mjs)
// ------------------------------------------------------------
// Build mode is deliberately NOT configured here. Vite resolves
// `isProduction` — which selects react/jsx-runtime vs react/jsx-dev-runtime,
// React's dev vs prod build, minification and `import.meta.env.PROD` — from
// `process.env.NODE_ENV` while it is still reading env files, i.e. BEFORE this
// config function runs (Vite 8: dist/node/chunks/node.js — `isNodeEnvSet` is
// captured, then a `.env` `NODE_ENV=development` is written back over it).
// Mutating process.env here is therefore ineffective.
//
// Consequence of getting it wrong: a local `.env` with NODE_ENV=development
// (or a CI job exporting NODE_ENV=test) yields a development bundle — no
// minification + react/jsx-dev-runtime — measured at a 684 KB initial chunk
// versus 229 KB with NODE_ENV=production.
//
// `npm run build` runs scripts/build.mjs, which sets NODE_ENV=production in the
// parent process before Vite starts. The check below warns if a build is ever
// invoked another way.
// ============================================================
export default defineConfig(({ command }) => {
  if (command === 'build' && process.env.NODE_ENV !== 'production') {
    console.warn(
      `⚠️  NODE_ENV=${process.env.NODE_ENV} — this build will contain the DEVELOPMENT React ` +
        'runtime and skip minification. Prefer `npm run build` (scripts/build.mjs).',
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Listen on ALL interfaces so the dev server is reachable from other
      // devices on the same Wi-Fi (e.g. a phone opening
      // http://<PC-LAN-IP>:5173). Without this, Vite binds to localhost only
      // and the phone cannot load the site at all.
      host: true,
      port: 5173,
      proxy: {
        // Forward same-origin API calls to the Express backend running on
        // this PC. The frontend (src/lib/api.js) uses RELATIVE /api URLs in
        // dev, so requests from ANY device (PC or phone) hit the Vite server
        // first and are proxied from the PC to the backend — no hardcoded
        // LAN IP anywhere, and the phone never needs direct access to :3001.
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        // Convenience: lets you verify reachability from the phone with
        // http://<PC-LAN-IP>:5173/health (same route the backend exposes).
        '/health': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
})
