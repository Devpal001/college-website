import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://knqirwyslekuiplagvvi.supabase.co';
const supabaseKey = 'sb_publishable_qyJI2xCPJjAt0I_ZHY-z9Q__xEKggeq';

export const supabase = createClient(supabaseUrl, supabaseKey);