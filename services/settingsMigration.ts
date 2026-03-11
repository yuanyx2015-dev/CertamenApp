import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { UserSettings } from './userSettingsService';

const MIGRATION_KEY = 'user_settings_migration_completed';

/**
 * One-time migration to move user_settings from Supabase to localStorage
 * This function will:
 * 1. Check if migration already completed
 * 2. Fetch user settings from Supabase
 * 3. Save them to AsyncStorage (localStorage)
 * 4. Mark migration as complete
 */
export const migrateUserSettingsToLocalStorage = async (userId: string): Promise<void> => {
  try {
    // Check if migration already completed for this user
    const migrationKey = `${MIGRATION_KEY}_${userId}`;
    const migrationCompleted = await AsyncStorage.getItem(migrationKey);
    
    if (migrationCompleted === 'true') {
      console.log('User settings migration already completed for user:', userId);
      return;
    }

    console.log('Starting user settings migration from Supabase to localStorage...');

    // Fetch existing settings from Supabase
    const { data: supabaseSettings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no settings found in Supabase (new user or already migrated), that's ok
      if (error.code === 'PGRST116') {
        console.log('No settings found in Supabase for user:', userId);
      } else {
        console.error('Error fetching settings from Supabase:', error);
      }
      
      // Mark migration as complete even if no data found
      await AsyncStorage.setItem(migrationKey, 'true');
      return;
    }

    if (supabaseSettings) {
      // Save settings to AsyncStorage
      const storageKey = `user_settings_${userId}`;
      const settingsToSave: UserSettings = {
        user_id: supabaseSettings.user_id,
        num_tossups: supabaseSettings.num_tossups || 20,
        wrong_questions_only: supabaseSettings.wrong_questions_only || false,
        sound_enabled: supabaseSettings.sound_enabled ?? true,
        notifications_enabled: supabaseSettings.notifications_enabled ?? true,
        theme: supabaseSettings.theme || 'light',
        language: supabaseSettings.language || 'en',
        created_at: supabaseSettings.created_at,
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(storageKey, JSON.stringify(settingsToSave));
      console.log('Successfully migrated user settings to localStorage:', settingsToSave);
    }

    // Mark migration as complete
    await AsyncStorage.setItem(migrationKey, 'true');
    console.log('User settings migration completed!');

  } catch (error) {
    console.error('Error during user settings migration:', error);
    // Don't throw - we don't want to block the app if migration fails
  }
};

/**
 * Check if migration is needed for a user
 */
export const isMigrationNeeded = async (userId: string): Promise<boolean> => {
  try {
    const migrationKey = `${MIGRATION_KEY}_${userId}`;
    const migrationCompleted = await AsyncStorage.getItem(migrationKey);
    return migrationCompleted !== 'true';
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
};
