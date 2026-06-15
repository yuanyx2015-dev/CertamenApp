/**
 * Mastery Rank model: earned purely from total mastered questions across all difficulties.
 * Every 100 mastered questions advances the user one rank.
 * Legatus Legionis is the permanent cap (reached at 1000 mastered).
 */

export const MASTERY_RANKS = [
  'Miles',
  'Cornicen',
  'Signifer',
  'Optio',
  'Centurio',
  'Aquilifer',
  'Primus Pilus',
  'Praefectus Castrorum',
  'Tribunus Angusticlavius',
  'Tribunus Laticlavius',
  'Legatus Legionis',
] as const;

export type MasteryRankName = (typeof MASTERY_RANKS)[number];

/** Questions needed per rank tier. */
export const MASTERY_RANK_THRESHOLD = 100;

/** Total number of mastery ranks. */
export const MASTERY_RANK_COUNT = MASTERY_RANKS.length; // 11

export interface RankStats {
  rankIndex: number;
  totalQuestions: number;
  mastered: number;
  wrong: number;
  unmastered: number;
}

/** Lowest rank that still has unmastered or wrong questions; else final rank. */
export function currentRankFromStats(stats: RankStats[]): number {
  for (let idx = 0; idx < MASTERY_RANK_COUNT; idx++) {
    const s = stats.find((x) => x.rankIndex === idx);
    if (!s || s.totalQuestions <= 0) continue;
    if (s.unmastered + s.wrong > 0) return idx;
  }
  return MASTERY_RANK_COUNT - 1;
}

/** Progress through a rank tier from live pool stats (0..1). */
export function rankProgressFromStats(stats: RankStats | undefined): number {
  if (!stats || stats.totalQuestions <= 0) return 0;
  return Math.min(1, Math.max(0, stats.mastered / stats.totalQuestions));
}

/** True when every assigned rank has no remaining unmastered or wrong questions. */
export function allRanksComplete(stats: RankStats[]): boolean {
  const withQuestions = stats.filter((s) => s.totalQuestions > 0);
  if (withQuestions.length === 0) return false;
  return withQuestions.every((s) => s.unmastered + s.wrong === 0);
}

/**
 * Returns the 0-based index of the rank the user currently holds.
 * Capped at MASTERY_RANK_COUNT - 1 (Legatus Legionis).
 */
export function masteryRankIndex(masteredCount: number): number {
  return Math.min(
    Math.floor(masteredCount / MASTERY_RANK_THRESHOLD),
    MASTERY_RANK_COUNT - 1
  );
}

/** Returns the name of the rank the user currently holds. */
export function masteryRankName(masteredCount: number): MasteryRankName {
  return MASTERY_RANKS[masteryRankIndex(masteredCount)];
}

/**
 * Progress through the current rank (0..1).
 * At Legatus Legionis the bar is always full.
 */
export function masteryRankProgress(masteredCount: number): number {
  const idx = masteryRankIndex(masteredCount);
  if (idx >= MASTERY_RANK_COUNT - 1) return 1;
  return (masteredCount % MASTERY_RANK_THRESHOLD) / MASTERY_RANK_THRESHOLD;
}

/**
 * How many questions the user has mastered within a specific rank tier.
 * Capped at MASTERY_RANK_THRESHOLD.
 */
export function masteredInRank(masteredCount: number, rankIdx: number): number {
  const rankStart = rankIdx * MASTERY_RANK_THRESHOLD;
  return Math.min(Math.max(masteredCount - rankStart, 0), MASTERY_RANK_THRESHOLD);
}

/**
 * Progress through a specific rank tier (0..1), used for the "All ranks" list.
 */
export function masteryRankProgressAt(masteredCount: number, rankIdx: number): number {
  return masteredInRank(masteredCount, rankIdx) / MASTERY_RANK_THRESHOLD;
}
