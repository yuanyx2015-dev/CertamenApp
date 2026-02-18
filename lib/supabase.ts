import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://wornkdfnyvhwrelsdaeb.supabase.co'; // Your Supabase project URL (e.g., 'https://xxxx.supabase.co')
const SUPABASE_ANON_KEY = 'sb_publishable_7-0UwQlRYrzlgVP0duWyzw__fWk6mOe'; // Your Supabase anon/public key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
