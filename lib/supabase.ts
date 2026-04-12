/**
 * Supabase client. Configure Google + Apple under Authentication → Providers.
 * Native Apple: bundle ID must match Apple Developer App ID; Services ID / JWT secret for server-side Apple config.
 */
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://wacgrqymaxoosciypebm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhY2dycXltYXhvb3NjaXlwZWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNTg1ODcsImV4cCI6MjA4NjYzNDU4N30.nWBJMVaPUIpg-5_vFCUPWF4zY3FUkCrn4rJ6wPA16d0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
