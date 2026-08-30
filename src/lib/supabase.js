import { createClient } from '@supabase/supabase-js';

// Single shared browser client for the whole app.
// Values come from .env; the literals are a fallback so the app
// still runs if the env vars are missing.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://knqirwyslekuiplagvvi.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qyJI2xCPJjAt0I_ZHY-z9Q__xEKggeq';

export const supabase = createClient(supabaseUrl, supabaseKey);