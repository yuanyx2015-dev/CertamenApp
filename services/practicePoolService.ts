import { getAllWrongQuestions } from './questionReviewService';
import { getAllMasteredQuestions } from './userMasteredService';
import type { PracticeQuestionPool, PracticeSessionDifficulty } from './userSettingsService';

/**
 * Practice pool counting for the "All / Wrong / Mastered" picker.
 *
 * Settings and the category picker need the same numbers the game will end up
 * with, so both read the pool through here rather than counting rows their own
 * way. Only the fields that narrow a pool are needed.
 */
export interface PracticePoolQuestion {
  id: string;
  category: string;
  difficulty: string;
}

/** Whole Challenge bank is ~1,100 rows, so one fetch can cover any user's pool. */
export const PRACTICE_POOL_FETCH_LIMIT = 1200;

export const PRACTICE_POOL_CATEGORIES = [
  'mythology',
  'history',
  'language',
  'literature',
  'culture-life',
  'living-latin',
] as const;

/**
 * Every question in the user's Wrong or Mastered list. `all` returns null
 * because the full bank isn't a per-user list and isn't counted up front.
 */
export const fetchPracticePoolQuestions = async (
  userId: string,
  pool: PracticeQuestionPool
): Promise<{ data: PracticePoolQuestion[] | null; error: any }> => {
  if (pool === 'all') return { data: null, error: null };

  const { data, error } =
    pool === 'wrong'
      ? await getAllWrongQuestions(userId, PRACTICE_POOL_FETCH_LIMIT)
      : await getAllMasteredQuestions(userId, PRACTICE_POOL_FETCH_LIMIT);

  if (error) return { data: null, error };

  const rows = (data ?? []).map((q) => ({
    id: q.id,
    category: q.category as string,
    difficulty: q.difficulty as string,
  }));

  return { data: rows, error: null };
};

export const countPoolAtDifficulties = (
  questions: PracticePoolQuestion[] | null,
  difficulties: PracticeSessionDifficulty[]
): number => {
  if (!questions) return 0;
  const allowed = new Set<string>(difficulties);
  return questions.filter((q) => allowed.has(q.difficulty)).length;
};

/** Per-category counts at the selected difficulties; every category gets a key. */
export const countPoolByCategory = (
  questions: PracticePoolQuestion[] | null,
  difficulties: PracticeSessionDifficulty[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const category of PRACTICE_POOL_CATEGORIES) counts[category] = 0;
  if (!questions) return counts;

  const allowed = new Set<string>(difficulties);
  for (const q of questions) {
    if (!allowed.has(q.difficulty)) continue;
    counts[q.category] = (counts[q.category] ?? 0) + 1;
  }
  return counts;
};

/**
 * Categories that can't supply a full set of `setSize` at these settings.
 * Drives the warning tag in Practice Settings.
 */
export const categoriesShortOfSetSize = (
  questions: PracticePoolQuestion[] | null,
  difficulties: PracticeSessionDifficulty[],
  setSize: number
): string[] => {
  if (!questions) return [];
  const counts = countPoolByCategory(questions, difficulties);
  return PRACTICE_POOL_CATEGORIES.filter((c) => (counts[c] ?? 0) < setSize);
};
