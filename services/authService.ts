import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

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
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
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

// Sign in with Apple OAuth
export const signInWithApple = async (): Promise<AuthResponse> => {
  try {
    const redirectUrl = makeRedirectUri({
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      return { error: { message: error.message } };
    }

    console.log('Apple OAuth data:', data);

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
          
          console.log('Apple session set successfully:', !!sessionData.session);
          return {
            user: sessionData.user || undefined,
            session: sessionData.session || undefined,
          };
        }
        
        return { error: { message: 'No tokens found in OAuth callback' } };
      } else {
        return { error: { message: 'Apple sign-in was cancelled' } };
      }
    }

    return { error: { message: 'No OAuth URL returned' } };
  } catch (error) {
    console.error('Apple sign-in error:', error);
    return {
      error: { message: 'An unexpected error occurred during Apple sign in' },
    };
  }
};

// Sign out the current user
export const signOut = async (): Promise<{ error?: AuthError }> => {
  try {
    const { error } = await supabase.auth.signOut();

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
