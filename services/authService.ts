import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_REDIRECT = () =>
  makeRedirectUri({
    scheme: 'certamenapp',
    path: 'auth/callback',
    // Bare / dev-client: skip Linking.createURL when expo-constants manifest is empty in JS.
    native: 'certamenapp://auth/callback',
  });

/** Shared browser OAuth flow for Google / Apple when native Apple is unavailable. */
async function completeOAuthBrowserSession(
  provider: 'google' | 'apple',
  queryParams?: Record<string, string>
): Promise<AuthResponse> {
  const redirectUrl = OAUTH_REDIRECT();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: false,
      ...(queryParams ? { queryParams } : {}),
    },
  });

  if (error) {
    return { error: { message: error.message } };
  }

  if (!data?.url) {
    return { error: { message: 'No OAuth URL returned' } };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type !== 'success') {
    return { error: { message: `${provider} sign-in was cancelled` } };
  }

  const url = result.url;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (url.includes('#')) {
    const fragment = url.split('#')[1];
    const params = new URLSearchParams(fragment);
    accessToken = params.get('access_token');
    refreshToken = params.get('refresh_token');
  }

  if (!accessToken || !refreshToken) {
    return { error: { message: 'No tokens found in OAuth callback' } };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    return { error: { message: sessionError.message } };
  }

  return {
    user: sessionData.user || undefined,
    session: sessionData.session || undefined,
  };
}

const APPLE_SCOPES = [
  AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
  AppleAuthentication.AppleAuthenticationScope.EMAIL,
];

const buildAppleDisplayName = (
  fullName?: AppleAuthentication.AppleAuthenticationFullName | null
) =>
  [fullName?.givenName, fullName?.middleName, fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

export interface AuthError {
  message: string;
}

export interface AuthResponse {
  user?: User;
  session?: Session;
  error?: AuthError;
}

// Sign up a new user

// export const signUp = async (
//   email: string,
//   password: string
// ): Promise<AuthResponse> => {
//   try {
//     const { data, error } = await supabase.auth.signUp({
//       email,
//       password,
//     });

//     if (error) {
//       return { error: { message: error.message } };
//     }

//     return {
//       user: data.user || undefined,
//       session: data.session || undefined,
//     };
//   } catch (error) {
//     return {
//       error: { message: 'An unexpected error occurred during sign up' },
//     };
//   }
// };

// // Sign in an existing user
// export const signIn = async (
//   email: string,
//   password: string
// ): Promise<AuthResponse> => {
//   try {
//     const { data, error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error) {
//       return { error: { message: error.message } };
//     }

//     return {
//       user: data.user || undefined,
//       session: data.session || undefined,
//     };
//   } catch (error) {
//     return {
//       error: { message: 'An unexpected error occurred during sign in' },
//     };
//   }
// };

// Sign in with Google OAuth
export const signInWithGoogle = async (): Promise<AuthResponse> => {
  try {
    console.log('Redirect URL:', OAUTH_REDIRECT());
    return await completeOAuthBrowserSession('google', {
      prompt: 'select_account',
    });
  } catch (error) {
    console.error('Google sign-in error:', error);
    return {
      error: { message: 'An unexpected error occurred during Google sign in' },
    };
  }
};

/**
 * Native-only: ASAuthorization + `signInWithIdToken` (best on physical iPhone).
 */
async function signInWithAppleNative(): Promise<AuthResponse> {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return {
        error: {
          message:
            'Apple Sign-In is not available on this device. Use a physical iPhone or iPad (Simulator often cannot use it).',
        },
      };
    }

    const rawBytes = await Crypto.getRandomBytesAsync(32);
    const rawNonce = Array.from(rawBytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: APPLE_SCOPES,
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return {
        error: {
          message: 'Apple Sign-In did not return an identity token.',
        },
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { error: { message: error.message } };
    }

    const displayName = buildAppleDisplayName(credential.fullName);
    if (displayName || credential.email) {
      const metadataUpdates: Record<string, string> = {};

      if (displayName) {
        metadataUpdates.full_name = displayName;
        metadataUpdates.name = displayName;
      }
      if (credential.fullName?.givenName) {
        metadataUpdates.given_name = credential.fullName.givenName;
      }
      if (credential.fullName?.familyName) {
        metadataUpdates.family_name = credential.fullName.familyName;
      }
      if (credential.email) {
        metadataUpdates.email = credential.email;
      }

      if (Object.keys(metadataUpdates).length > 0) {
        const { data: updatedUserData, error: updateError } =
          await supabase.auth.updateUser({
            data: metadataUpdates,
          });

        if (updateError) {
          console.warn('Unable to persist Apple user metadata:', updateError);
        } else if (updatedUserData.user) {
          return {
            user: updatedUserData.user,
            session: data.session || undefined,
          };
        }
      }
    }

    return {
      user: data.user || undefined,
      session: data.session || undefined,
    };
  } catch (error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    if (code === 'ERR_REQUEST_CANCELED') {
      return { error: { message: 'Apple sign-in was cancelled.' } };
    }
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('canceled')
    ) {
      return { error: { message: 'Apple sign-in was cancelled.' } };
    }

    console.error('Apple sign-in error:', error);
    return {
      error: { message: 'An unexpected error occurred during Apple sign in' },
    };
  }
}

/**
 * Apple via Supabase OAuth (browser). Use on Android, Expo Go, Simulator, or when native is unavailable.
 */
async function signInWithAppleOAuth(): Promise<AuthResponse> {
  try {
    return await completeOAuthBrowserSession('apple');
  } catch (error) {
    console.error('Apple OAuth error:', error);
    return {
      error: { message: 'An unexpected error occurred during Apple sign in' },
    };
  }
}

/**
 * Prefer native Sign in with Apple on iOS when available; otherwise OAuth (works on more devices).
 */
export const signInWithApple = async (): Promise<AuthResponse> => {
  if (Platform.OS === 'ios') {
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (available) {
        return await signInWithAppleNative();
      }
    } catch (e) {
      console.warn('Apple native unavailable, using OAuth:', e);
    }
  }
  return signInWithAppleOAuth();
};

// Sign out the current user
export const signOut = async (): Promise<{ error?: AuthError }> => {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });

    if (error) {
      return { error: { message: error.message } };
    }

    return {};
  } catch (error) {
    return {
      error: { message: 'An unexpected error occurred during sign out' },
    };
  }
};

// Get the current session
export const getSession = async (): Promise<Session | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting session:', error.message);
      return null;
    }

    return data.session;
  } catch (error) {
    console.error('Unexpected error getting session:', error);
    return null;
  }
};

// Get the current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Error getting user:', error.message);
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Unexpected error getting user:', error);
    return null;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (
  callback: (event: string, session: Session | null) => void
) => {
  return supabase.auth.onAuthStateChange(callback);
};
