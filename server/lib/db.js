import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================
// SUPABASE SERVER CLIENT (SERVICE ROLE)
// ============================================
// This module is SERVER-SIDE ONLY.
// It uses the service-role/secret key which bypasses RLS.
// NEVER import this file from frontend code.
// NEVER expose the secret key in frontend code.

// Load the project .env from the repo root (college-website/.env).
// This runs at import time (before any caller's dotenv.config), so the
// Supabase client initializes correctly no matter which entry point
// imports this module. dotenv never overrides already-set variables.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const env = globalThis.process?.env ?? {};

const SUPABASE_URL = env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is missing. Check the .env file.');
  throw new Error('SUPABASE_URL is missing');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing. Check the .env file.');
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export default supabase;