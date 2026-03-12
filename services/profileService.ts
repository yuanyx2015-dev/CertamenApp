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
    // First, try to get existing profile by email
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single();

    if (existingProfile) {
      console.log('Profile found:', existingProfile);
      return { data: existingProfile, error: null };
    }

    // If no profile exists, create one
    if (fetchError && fetchError.code === 'PGRST116') {
      // Extract username from email or use metadata
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

      const newProfile: Partial<Profile> = {
        username,
        display_name: displayName,
        email: user.email || null,
        avatar_url: avatarUrl,
      };

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return { data: null, error: createError };
      }

      console.log('Profile created:', createdProfile);
      return { data: createdProfile, error: null };
    }

    // Some other error occurred
    console.error('Error fetching profile:', fetchError);
    return { data: null, error: fetchError };
  } catch (error: any) {
    console.error('Unexpected error in getOrCreateProfile:', error);
    return { data: null, error };
  }
};

/**
 * Update an existing profile
 */
export const updateProfile = async (
  profileId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ data: Profile | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error updating profile:', error);
    return { data: null, error };
  }
};

/**
 * Get profile by ID
 */
export const getProfileById = async (profileId: string): Promise<{ data: Profile | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching profile:', error);
    return { data: null, error };
  }
};

/**
 * Get profile by username
 */
export const getProfileByUsername = async (username: string): Promise<{ data: Profile | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      console.error('Error fetching profile by username:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching profile by username:', error);
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
