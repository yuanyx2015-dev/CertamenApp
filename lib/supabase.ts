import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://wacgrqymaxoosciypebm.supabase.co'; // Your Supabase project URL
// ⚠️ IMPORTANT: This should be the "anon public" key, not the publishable key
// Get it from: Supabase Dashboard → Settings → API → Project API keys → anon/public
// It should start with 'eyJ...'
const SUPABASE_ANON_KEY = 'sb_publishable_yNRU8xu5AkoR2uq50vwmyw_jOho-v_R'; // Your anon key for this project

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
