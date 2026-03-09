import { supabase } from '../lib/supabase';

export interface UserSettings {
  user_id: string;
  num_tossups: number;
  wrong_questions_only: boolean;
  sound_enabled: boolean;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  created_at?: string;
  updated_at?: string;
}

// Get user settings from database (or create default if doesn't exist)
export const getOrCreateUserSettings = async (userId: string) => {
  try {
    // Try to get existing settings
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no settings found, create default settings
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: createError } = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            num_tossups: 20,
            wrong_questions_only: false,
            sound_enabled: true,
            notifications_enabled: true,
            theme: 'light',
            language: 'en',
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating user settings:', createError);
          return { data: null, error: createError };
        }

        return { data: newSettings, error: null };
      }

      console.error('Error fetching user settings:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getOrCreateUserSettings:', error);
    return { data: null, error };
  }
};

// Update user settings
export const updateUserSettings = async (
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>>
) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .update(settings)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user settings:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error in updateUserSettings:', error);
    return { data: null, error };
  }
};

// Update specific setting
export const updateSetting = async (
  userId: string,
  settingName: keyof Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>,
  value: any
) => {
  return updateUserSettings(userId, { [settingName]: value });
};

// Reset settings to defaults
export const resetUserSettings = async (userId: string) => {
  return updateUserSettings(userId, {
    num_tossups: 20,
    wrong_questions_only: false,
    sound_enabled: true,
    notifications_enabled: true,
    theme: 'light',
    language: 'en',
  });
};
