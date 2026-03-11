import AsyncStorage from '@react-native-async-storage/async-storage';

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

const STORAGE_KEY = 'user_settings';

// Helper function to get storage key for a user
const getUserStorageKey = (userId: string) => `${STORAGE_KEY}_${userId}`;

// Default settings
const getDefaultSettings = (userId: string): UserSettings => ({
  user_id: userId,
  num_tossups: 20,
  wrong_questions_only: false,
  sound_enabled: true,
  notifications_enabled: true,
  theme: 'light',
  language: 'en',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Get user settings from localStorage (or create default if doesn't exist)
export const getOrCreateUserSettings = async (userId: string) => {
  try {
    const storageKey = getUserStorageKey(userId);
    const settingsJson = await AsyncStorage.getItem(storageKey);

    if (settingsJson) {
      // Parse and return existing settings
      const data = JSON.parse(settingsJson) as UserSettings;
      return { data, error: null };
    } else {
      // Create default settings
      const newSettings = getDefaultSettings(userId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newSettings));
      return { data: newSettings, error: null };
    }
  } catch (error: any) {
    console.error('Error in getOrCreateUserSettings:', error);
    return { data: null, error };
  }
};

// Update user settings
export const updateUserSettings = async (
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>>
) => {
  try {
    const storageKey = getUserStorageKey(userId);
    
    // Get existing settings
    const { data: existingSettings, error: getError } = await getOrCreateUserSettings(userId);
    
    if (getError || !existingSettings) {
      return { data: null, error: getError || new Error('Failed to get existing settings') };
    }

    // Merge with new settings
    const updatedSettings: UserSettings = {
      ...existingSettings,
      ...settings,
      updated_at: new Date().toISOString(),
    };

    // Save to localStorage
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSettings));

    return { data: updatedSettings, error: null };
  } catch (error: any) {
    console.error('Error updating user settings:', error);
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
