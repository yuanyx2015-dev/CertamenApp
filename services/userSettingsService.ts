import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAppReviewState } from '../lib/appReview';
import { clearPracticeLocalData } from './practiceClearedService';

export type PracticeSessionDifficulty = 'easy' | 'medium' | 'hard';

/** Canonical order for Practice difficulty multi-select. */
export const PRACTICE_DIFFICULTY_OPTIONS: PracticeSessionDifficulty[] = [
  'easy',
  'medium',
  'hard',
];

export interface UserSettings {
  user_id: string;
  num_tossups: number;
  wrong_questions_only: boolean;
  /** One or more difficulties (never empty after normalize). Legacy single string is migrated. */
  practice_session_difficulty?: PracticeSessionDifficulty | PracticeSessionDifficulty[];
  sound_enabled: boolean;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  created_at?: string;
  updated_at?: string;
}

/** Normalize stored difficulty to a non-empty unique list in easy → hard order. */
export function normalizePracticeDifficulties(
  value: UserSettings['practice_session_difficulty']
): PracticeSessionDifficulty[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const allowed = new Set<PracticeSessionDifficulty>(PRACTICE_DIFFICULTY_OPTIONS);
  const picked = new Set<PracticeSessionDifficulty>();
  for (const d of raw) {
    if (allowed.has(d as PracticeSessionDifficulty)) {
      picked.add(d as PracticeSessionDifficulty);
    }
  }
  const ordered = PRACTICE_DIFFICULTY_OPTIONS.filter((d) => picked.has(d));
  return ordered.length > 0 ? ordered : ['easy'];
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

/** Wipe all device-local data tied to an account (settings + review prompt flags). */
export async function clearAllLocalAccountData(userId: string): Promise<void> {
  await Promise.all([
    clearAllLocalUserSettings(userId),
    clearAppReviewState(),
    clearPracticeLocalData(userId),
  ]);
}

const getDefaultSettings = (userId: string): UserSettings => ({
  user_id: userId,
  num_tossups: 20,
  wrong_questions_only: false,
  practice_session_difficulty: ['easy'],
  sound_enabled: true,
  notifications_enabled: true,
  theme: 'light',
  language: 'en',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

function normalizeParsedSettings(data: UserSettings): UserSettings {
  return {
    ...data,
    practice_session_difficulty: normalizePracticeDifficulties(
      data.practice_session_difficulty
    ),
  };
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
