/**
 * Challenge Mode rank model: one Roman military rank per difficulty.
 * Replaces the old 7-rank score-based progression.
 */

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export interface ChallengeRank {
  difficulty: ChallengeDifficulty;
  name: string;
  shortName: string;
}

export const CHALLENGE_RANKS: Record<ChallengeDifficulty, ChallengeRank> = {
  easy: { difficulty: 'easy', name: 'Miles', shortName: 'M' },
  medium: { difficulty: 'medium', name: 'Primus Pilus', shortName: 'PP' },
  hard: { difficulty: 'hard', name: 'Legatus Legionis', shortName: 'LL' },
};

export const DIFFICULTY_ORDER: ChallengeDifficulty[] = ['easy', 'medium', 'hard'];

export function rankForDifficulty(d: ChallengeDifficulty): ChallengeRank {
  return CHALLENGE_RANKS[d];
}

export function nextDifficulty(d: ChallengeDifficulty): ChallengeDifficulty | null {
  const idx = DIFFICULTY_ORDER.indexOf(d);
  if (idx < 0 || idx >= DIFFICULTY_ORDER.length - 1) return null;
  return DIFFICULTY_ORDER[idx + 1];
}

export interface DifficultyStats {
  difficulty: ChallengeDifficulty;
  totalQuestions: number;
  mastered: number;
  wrong: number;
  unmastered: number;
}

/**
 * Pick the user's current difficulty: lowest difficulty that still has unmastered + wrong > 0.
 * If all difficulties are complete, returns 'hard' (the pinnacle).
 */
export function currentDifficulty(stats: DifficultyStats[]): ChallengeDifficulty {
  for (const d of DIFFICULTY_ORDER) {
    const s = stats.find((x) => x.difficulty === d);
    if (!s) continue;
    if (s.unmastered + s.wrong > 0) return d;
  }
  return 'hard';
}

/**
 * Progress through the current difficulty (0..1). Filled = mastered / total.
 * If total is 0, returns 0.
 */
export function difficultyProgress(stats: DifficultyStats | undefined): number {
  if (!stats || stats.totalQuestions <= 0) return 0;
  return Math.min(1, Math.max(0, stats.mastered / stats.totalQuestions));
}
