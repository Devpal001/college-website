import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
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
})
