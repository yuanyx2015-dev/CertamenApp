import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const APPLE_SCOPES = [
  AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
  AppleAuthentication.AppleAuthenticationScope.EMAIL,
];

const createNonce = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

const hashNonce = async (value: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);

const buildAppleDisplayName = (
  fullName?: AppleAuthentication.AppleAuthenticationFullName | null
) =>
  [
    fullName?.givenName,
    fullName?.middleName,
    fullName?.familyName,
  ]
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
    const redirectUrl = makeRedirectUri({
      scheme: 'certamenapp',
      path: 'auth/callback',
    });

    console.log('Redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    // console.log('Google OAuth data:', data);

    if (error) {
      return { error: { message: error.message } };
    }


    // Open the OAuth URL in browser
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );


      if (result.type === 'success') {
        const url = result.url;
                
        // Supabase OAuth returns tokens in URL fragment (after #), not query params
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        
        // Extract fragment (everything after #)
        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          const params = new URLSearchParams(fragment);
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
        }
      
        
        if (accessToken && refreshToken) {
          // Set the session using the tokens from OAuth callback
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error('Error setting session:', sessionError);
            return { error: { message: sessionError.message } };
          }
          
          console.log('Session set successfully:', !!sessionData.session);
          return {
            user: sessionData.user || undefined,
            session: sessionData.session || undefined,
          };
        }
        
        return { error: { message: 'No tokens found in OAuth callback' } };
      } else {
        return { error: { message: 'Google sign-in was cancelled' } };
      }
    }

    return { error: { message: 'No OAuth URL returned' } };
  } catch (error) {
    console.error('Google sign-in error:', error);
    return {
      error: { message: 'An unexpected error occurred during Google sign in' },
    };
  }
};

// Sign in with Apple (native ASAuthorization + Supabase signInWithIdToken)
export const signInWithApple = async (): Promise<AuthResponse> => {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return {
        error: {
          message:
            'Apple Sign-In is not available here. It requires a physical iPhone or iPad (not the Simulator).',
        },
      };
    }

    const rawNonce = createNonce();
    const hashedNonce = await hashNonce(rawNonce);

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
