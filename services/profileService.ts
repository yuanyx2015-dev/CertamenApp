import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get or create a user profile in the profiles table
 * This should be called after successful authentication
 */
export const getOrCreateProfile = async (user: User): Promise<{ data: Profile | null; error: any }> => {
  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile) {
      console.log('Profile found:', existingProfile);
      return { data: existingProfile, error: null };
    }

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return { data: null, error: fetchError };
    }

    const username =
      user.user_metadata?.full_name?.toLowerCase().replace(/\s+/g, '_') ||
      user.email?.split('@')[0] ||
      `user_${Date.now()}`;

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User';

    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    const { data: createdProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username,
        display_name: displayName,
        email: user.email || null,
        avatar_url: avatarUrl,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return { data: null, error: createError };
    }

    console.log('Profile created:', createdProfile);
    return { data: createdProfile, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getOrCreateProfile:', error);
    return { data: null, error };
  }
};

/**
 * Get profile by email
 */
export const getProfileByEmail = async (email: string): Promise<{ data: Profile | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error fetching profile by email:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching profile by email:', error);
    return { data: null, error };
  }
};

/**
 * Delete user account completely (all server data + auth user).
 * Device-local cleanup (settings, review flags) should run before calling this.
 */
export const deleteAccount = async (): Promise<{ error: any }> => {
  try {
    console.log('Calling delete_user_account RPC function...');

    const { data, error } = await supabase.rpc('delete_user_account');

    console.log('RPC response data:', data);
    console.log('RPC response error:', error);

    if (error) {
      console.error('Error calling delete_user_account:', error);
      return { error };
    }

    if (data?.error) {
      console.error('Error from delete_user_account:', data.error);
      return { error: { message: data.error } };
    }

    console.log('Account deleted successfully via RPC');
    return { error: null };
  } catch (error: any) {
    console.error('Unexpected error deleting account:', error);
    return { error };
  }
};
