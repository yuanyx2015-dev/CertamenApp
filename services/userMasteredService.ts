import { supabase } from '../lib/supabase';
import type { RankStats } from '../lib/masteryRanks';
import { MASTERY_RANK_COUNT } from '../lib/masteryRanks';
import type { Question } from './questionService';

export interface MasteredAnswerRow {
  id: string;
  user_id: string;
  question_id: string;
  mastered_at: string;
}

/**
 * Mark a question as mastered. Removes it from user_wrong_answers if present.
 * Atomic via SQL RPC.
 */
export const masterQuestion = async (userId: string, questionId: string) => {
  const { error } = await supabase.rpc('master_question', {
    p_user_id: userId,
    p_question_id: questionId,
  });

  if (error) {
    console.error('Error mastering question:', error);
  }

  return { error };
};

/**
 * Per-rank Challenge pool stats (total / mastered / wrong / unmastered).
 */
export const getRankStats = async (userId: string) => {
  const { data, error } = await supabase.rpc('get_rank_stats', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error fetching rank stats:', error);
    return { data: null as RankStats[] | null, error };
  }

  const rows = (data ?? []) as Array<{
    rank_index: number | string;
    total_questions: number | string;
    mastered: number | string;
    wrong: number | string;
    unmastered: number | string;
  }>;

  const stats: RankStats[] = rows
    .map((r) => ({
      rankIndex: Number(r.rank_index),
      totalQuestions: Number(r.total_questions) || 0,
      mastered: Number(r.mastered) || 0,
      wrong: Number(r.wrong) || 0,
      unmastered: Number(r.unmastered) || 0,
    }))
    .filter(
      (r) => r.rankIndex >= 0 && r.rankIndex < MASTERY_RANK_COUNT && !Number.isNaN(r.rankIndex)
    );

  return { data: stats, error: null };
};

/**
 * Pull the next batch from a rank's fixed-order pool.
 * Unseen questions first (pool_order), then passed (oldest last).
 */
export const getRankPoolQuestions = async (
  userId: string,
  rankIndex: number,
  limit: number
): Promise<{ data: Question[] | null; error: any }> => {
  const { data, error } = await supabase.rpc('get_rank_pool_questions', {
    p_user_id: userId,
    p_rank_index: rankIndex,
    p_limit: limit,
  });

  if (error) {
    console.error('Error fetching rank pool questions:', error);
    return { data: null, error };
  }

  return { data: (data ?? []) as Question[], error: null };
};

/**
 * Count of mastered questions for the user (all difficulties).
 */
export const getMasteredCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('user_mastered_answers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return { data: 0, error };
  }
  return { data: count ?? 0, error: null };
};
