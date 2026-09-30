// ============================================================
// SUPABASE CLIENT  (heavy — never import this module directly)
// ------------------------------------------------------------
// This file pulls in the whole Supabase SDK: ~203 KB raw / ~53 KB gzipped,
// because `createClient()` eagerly constructs the auth, postgrest, realtime,
// storage and functions clients. The browser only ever calls
// `supabase.auth.*` (sign in / session / sign out) — the other four clients
// are dead weight here and are used server-side only (`server/lib/supabase.js`),
// where bundle size does not apply.
//
// It is therefore loaded through `getSupabase()` in lib/supabase.js, which
// Vite emits as a separate chunk and the browser fetches only when a session
// exists or the visitor is about to sign in. See BRAIN.md → Performance.
// ============================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing required Supabase configuration. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your environment.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
