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

/** Rank-up uses legacy `user_settings_<id>`; practice uses `user_settings_practice_<id>`. */
export type UserSettingsScope = 'rank-up' | 'practice';

const STORAGE_KEY = 'user_settings';

function getUserStorageKey(userId: string, scope: UserSettingsScope): string {
  if (scope === 'practice') {
    return `${STORAGE_KEY}_practice_${userId}`;
  }
  return `${STORAGE_KEY}_${userId}`;
}

/** Remove both rank-up and practice settings blobs for this user (e.g. account deletion). */
export async function clearAllLocalUserSettings(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([
    getUserStorageKey(userId, 'rank-up'),
    getUserStorageKey(userId, 'practice'),
  ]);
}

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

export const getOrCreateUserSettings = async (
  userId: string,
  scope: UserSettingsScope = 'rank-up'
) => {
  try {
    const storageKey = getUserStorageKey(userId, scope);
    const settingsJson = await AsyncStorage.getItem(storageKey);

    if (settingsJson) {
      const data = JSON.parse(settingsJson) as UserSettings;
      return { data, error: null };
    } else {
      const newSettings = getDefaultSettings(userId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newSettings));
      return { data: newSettings, error: null };
    }
  } catch (error: any) {
    console.error('Error in getOrCreateUserSettings:', error);
    return { data: null, error };
  }
};

export const updateUserSettings = async (
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>>,
  scope: UserSettingsScope = 'rank-up'
) => {
  try {
    const storageKey = getUserStorageKey(userId, scope);

    const { data: existingSettings, error: getError } = await getOrCreateUserSettings(userId, scope);

    if (getError || !existingSettings) {
      return { data: null, error: getError || new Error('Failed to get existing settings') };
    }

    const updatedSettings: UserSettings = {
      ...existingSettings,
      ...settings,
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSettings));

    return { data: updatedSettings, error: null };
  } catch (error: any) {
    console.error('Error updating user settings:', error);
    return { data: null, error };
  }
};

export const updateSetting = async (
  userId: string,
  settingName: keyof Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>,
  value: any,
  scope: UserSettingsScope = 'rank-up'
) => {
  return updateUserSettings(userId, { [settingName]: value }, scope);
};

export const resetUserSettings = async (userId: string, scope: UserSettingsScope = 'rank-up') => {
  return updateUserSettings(
    userId,
    {
      num_tossups: 20,
      wrong_questions_only: false,
      sound_enabled: true,
      notifications_enabled: true,
      theme: 'light',
      language: 'en',
    },
    scope
  );
};
