import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device-local Practice clears: questions the user held-to-clear in Practice.
 * These stay out of future Practice pools only — never mastery / Review / ranks.
 */

const CLEARED_KEY = (userId: string) => `practice_cleared_ids_${userId}`;
const ENTRY_TIP_KEY = (userId: string) => `practice_clear_tip_entries_${userId}`;

/** How many Practice category entries still show the permanent-clear tip. */
export const PRACTICE_CLEAR_TIP_ENTRY_LIMIT = 5;

export async function getPracticeClearedIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(CLEARED_KEY(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export async function addPracticeClearedId(userId: string, questionId: string): Promise<void> {
  const ids = await getPracticeClearedIds(userId);
  if (ids.has(questionId)) return;
  ids.add(questionId);
  await AsyncStorage.setItem(CLEARED_KEY(userId), JSON.stringify([...ids]));
}

/** Returns the entry count after incrementing (1 on first entry). */
export async function recordPracticeCategoryEntry(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ENTRY_TIP_KEY(userId));
    const prev = raw ? parseInt(raw, 10) : 0;
    const next = (Number.isFinite(prev) ? prev : 0) + 1;
    await AsyncStorage.setItem(ENTRY_TIP_KEY(userId), String(next));
    return next;
  } catch {
    return 1;
  }
}

export async function getPracticeCategoryEntryCount(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ENTRY_TIP_KEY(userId));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function clearPracticeLocalData(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([CLEARED_KEY(userId), ENTRY_TIP_KEY(userId)]);
}
