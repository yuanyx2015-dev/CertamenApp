import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAppReviewState } from '../lib/appReview';
import { clearPracticeLocalData } from './practiceClearedService';

export type PracticeSessionDifficulty = 'easy' | 'medium' | 'hard';

/** Practice pool picker: the whole bank, or only the user's wrong / mastered lists. */
export type PracticeQuestionPool = 'all' | 'wrong' | 'mastered';

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
  /** Practice pool: all / wrong / mastered. Legacy rows only have wrong_questions_only. */
  practice_question_pool?: PracticeQuestionPool;
  /** One or more difficulties (never empty after normalize). Legacy single string is migrated. */
  practice_session_difficulty?: PracticeSessionDifficulty | PracticeSessionDifficulty[];
  /** Seconds to buzz after the tossup finishes typing (Practice). */
  pre_buzz_seconds?: number;
  /** Seconds to answer after buzzing (Practice). */
  answer_seconds?: number;
  /**
   * Toss-up reading speed multiplier (Practice).
   * 1.0x = default typewriter pace; higher = faster.
   */
  reading_speed_multiplier?: number;
  sound_enabled: boolean;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PRE_BUZZ_SECONDS = 10;
export const DEFAULT_ANSWER_SECONDS = 5;
export const DEFAULT_READING_SPEED_MULTIPLIER = 1;
export const PRE_BUZZ_SECONDS_MIN = 3;
export const PRE_BUZZ_SECONDS_MAX = 60;
export const ANSWER_SECONDS_MIN = 3;
export const ANSWER_SECONDS_MAX = 30;
/** Discrete reading-speed stops for the Practice typewriter slider. */
export const READING_SPEED_STOPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5] as const;
export type ReadingSpeedStop = (typeof READING_SPEED_STOPS)[number];
export const READING_SPEED_MIN = READING_SPEED_STOPS[0];
export const READING_SPEED_MAX = READING_SPEED_STOPS[READING_SPEED_STOPS.length - 1];
/** Base typewriter delay at 1.0x (ms per character). */
export const BASE_STREAM_MS_PER_CHAR = 50;

export function clampPreBuzzSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : DEFAULT_PRE_BUZZ_SECONDS;
  if (!Number.isFinite(n)) return DEFAULT_PRE_BUZZ_SECONDS;
  return Math.max(PRE_BUZZ_SECONDS_MIN, Math.min(PRE_BUZZ_SECONDS_MAX, Math.round(n)));
}

export function clampAnswerSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : DEFAULT_ANSWER_SECONDS;
  if (!Number.isFinite(n)) return DEFAULT_ANSWER_SECONDS;
  return Math.max(ANSWER_SECONDS_MIN, Math.min(ANSWER_SECONDS_MAX, Math.round(n)));
}

/**
 * Parse typed timer text on commit.
 * - Digits only: 0–2 → min, above max → max, otherwise the number
 * - Anything else (symbols, letters, negatives, decimals) → null (keep prior value)
 */
export function parseTimerSecondsInput(
  text: string,
  min: number,
  max: number
): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n <= 2) return min;
  if (n > max) return max;
  return n;
}

/** Snap to the nearest discrete reading-speed stop. */
export function clampReadingSpeedMultiplier(value: unknown): number {
  const n = typeof value === 'number' ? value : DEFAULT_READING_SPEED_MULTIPLIER;
  if (!Number.isFinite(n)) return DEFAULT_READING_SPEED_MULTIPLIER;
  let best: number = READING_SPEED_STOPS[0];
  let bestDist = Infinity;
  for (const stop of READING_SPEED_STOPS) {
    const dist = Math.abs(stop - n);
    if (dist < bestDist) {
      bestDist = dist;
      best = stop;
    }
  }
  return best;
}

export function formatReadingSpeedLabel(value: number): string {
  const v = clampReadingSpeedMultiplier(value);
  return `${v}x`;
}

/** Typewriter interval for a reading-speed multiplier (ms per character). */
export function streamIntervalMsForReadingSpeed(multiplier: number): number {
  const speed = clampReadingSpeedMultiplier(multiplier);
  return Math.max(8, Math.round(BASE_STREAM_MS_PER_CHAR / speed));
}

/** Defaults for the Further adjustments block (not set size / difficulty / wrong-only). */
export const FURTHER_ADJUSTMENT_DEFAULTS = {
  pre_buzz_seconds: DEFAULT_PRE_BUZZ_SECONDS,
  answer_seconds: DEFAULT_ANSWER_SECONDS,
  reading_speed_multiplier: DEFAULT_READING_SPEED_MULTIPLIER,
} as const;

/** Resolve pool from the new field, falling back to the old boolean. */
export function normalizePracticeQuestionPool(
  pool: UserSettings['practice_question_pool'],
  wrongOnly: boolean
): PracticeQuestionPool {
  if (pool === 'all' || pool === 'wrong' || pool === 'mastered') return pool;
  return wrongOnly ? 'wrong' : 'all';
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
  practice_question_pool: 'all',
  practice_session_difficulty: ['easy'],
  pre_buzz_seconds: DEFAULT_PRE_BUZZ_SECONDS,
  answer_seconds: DEFAULT_ANSWER_SECONDS,
  reading_speed_multiplier: DEFAULT_READING_SPEED_MULTIPLIER,
  sound_enabled: true,
  notifications_enabled: true,
  theme: 'light',
  language: 'en',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

function normalizeParsedSettings(data: UserSettings): UserSettings {
  const practice_question_pool = normalizePracticeQuestionPool(
    data.practice_question_pool,
    !!data.wrong_questions_only
  );
  return {
    ...data,
    practice_question_pool,
    wrong_questions_only: practice_question_pool === 'wrong',
    practice_session_difficulty: normalizePracticeDifficulties(
      data.practice_session_difficulty
    ),
    pre_buzz_seconds: clampPreBuzzSeconds(data.pre_buzz_seconds),
    answer_seconds: clampAnswerSeconds(data.answer_seconds),
    reading_speed_multiplier: clampReadingSpeedMultiplier(data.reading_speed_multiplier),
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
