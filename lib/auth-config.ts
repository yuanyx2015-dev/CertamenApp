import { makeRedirectUri } from 'expo-auth-session';

// Get the proper redirect URI for your environment
export const getRedirectUrl = () => {
  return makeRedirectUri({
    scheme: 'certamenapp',
    path: 'auth/callback',
  });
};

// This will generate URLs like:
// - Development: exp://192.168.x.x:8081/--/auth/callback
// - Standalone: certamenapp://auth/callback
