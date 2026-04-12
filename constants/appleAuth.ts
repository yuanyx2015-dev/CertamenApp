/**
 * Public identifiers for Sign in with Apple + Supabase (must match Apple Developer & Supabase dashboard).
 * Do not put .p8 contents or JWT client secrets here.
 */
import { SUPABASE_URL } from '../lib/supabase';

export const APPLE_BUNDLE_ID = 'com.ziyouyuan.certamenapp';
export const APPLE_SERVICES_ID = 'com.ziyouyuan.certamenapp.siwa';
export const APPLE_TEAM_ID = 'YY545WKA4Y';
export const APPLE_KEY_ID = 'TJ2G482B3T';

/** Use in Apple Services ID return URLs and Supabase redirect allowlist where applicable. */
export const SUPABASE_AUTH_CALLBACK_URL = `${SUPABASE_URL}/auth/v1/callback`;
