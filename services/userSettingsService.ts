import AsyncStorage from '@react-native-async-storage/async-storage';

export type PracticeSessionDifficulty = 'easy' | 'medium' | 'hard';

export interface UserSettings {
  user_id: string;
  num_tossups: number;
  wrong_questions_only: boolean;
  practice_session_difficulty?: PracticeSessionDifficulty;
  sound_enabled: boolean;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  created_at?: string;
  updated_at?: string;
}

/** @deprecated Rank-up settings removed; only practice settings remain. */
export type UserSettingsScope = 'practice';

const STORAGE_KEY = 'user_settings';

function getUserStorageKey(userId: string): string {
  return `${STORAGE_KEY}_practice_${userId}`;
}

/** Remove practice settings blob for this user (e.g. account deletion). */
export async function clearAllLocalUserSettings(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([
    getUserStorageKey(userId),
    `${STORAGE_KEY}_${userId}`, // legacy rank-up key
  ]);
}

const getDefaultSettings = (userId: string): UserSettings => ({
  user_id: userId,
  num_tossups: 20,
  wrong_questions_only: false,
  practice_session_difficulty: 'easy',
  sound_enabled: true,
  notifications_enabled: true,
  theme: 'light',
  language: 'en',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

function normalizeParsedSettings(data: UserSettings): UserSettings {
  const d = data.practice_session_difficulty;
  const ok = d === 'easy' || d === 'medium' || d === 'hard';
  return { ...data, practice_session_difficulty: ok ? d : 'easy' };
}

export const getOrCreateUserSettings = async (userId: string) => {
  try {
    const storageKey = getUserStorageKey(userId);
    const settingsJson = await AsyncStorage.getItem(storageKey);

    if (settingsJson) {
      const parsed = JSON.parse(settingsJson) as UserSettings;
      const data = normalizeParsedSettings(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(data)) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      }
      return { data, error: null };
    }

    const newSettings = getDefaultSettings(userId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(newSettings));
    return { data: newSettings, error: null };
  } catch (error: any) {
    console.error('Error in getOrCreateUserSettings:', error);
    return { data: null, error };
  }
};

export const updateUserSettings = async (
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>>
) => {
  try {
    const storageKey = getUserStorageKey(userId);

    const { data: existingSettings, error: getError } = await getOrCreateUserSettings(userId);

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
  value: any
) => {
  return updateUserSettings(userId, { [settingName]: value });
};
