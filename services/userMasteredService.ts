import { supabase } from '../lib/supabase';
import type {
  ChallengeDifficulty,
  DifficultyStats,
} from '../lib/challengeRanks';
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
 * Unmaster (remove a question from the mastered set, e.g. for testing or future "unmaster" UI).
 */
export const unmasterQuestion = async (userId: string, questionId: string) => {
  const { error } = await supabase
    .from('user_mastered_answers')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId);

  if (error) {
    console.error('Error unmastering question:', error);
  }

  return { error };
};

/**
 * Is this question mastered by the user?
 */
export const isQuestionMastered = async (userId: string, questionId: string) => {
  const { data, error } = await supabase
    .from('user_mastered_answers')
    .select('id')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (error) {
    return { data: false, error };
  }
  return { data: !!data, error: null };
};

/**
 * Per-difficulty counts: total, mastered, wrong, unmastered.
 */
export const getDifficultyStats = async (userId: string) => {
  const { data, error } = await supabase.rpc('get_difficulty_stats', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error fetching difficulty stats:', error);
    return { data: null as DifficultyStats[] | null, error };
  }

  const rows = (data ?? []) as Array<{
    difficulty: string;
    total_questions: number | string;
    mastered: number | string;
    wrong: number | string;
    unmastered: number | string;
  }>;

  const stats: DifficultyStats[] = rows
    .filter(
      (r): r is typeof r & { difficulty: ChallengeDifficulty } =>
        r.difficulty === 'easy' || r.difficulty === 'medium' || r.difficulty === 'hard'
    )
    .map((r) => ({
      difficulty: r.difficulty,
      totalQuestions: Number(r.total_questions) || 0,
      mastered: Number(r.mastered) || 0,
      wrong: Number(r.wrong) || 0,
      unmastered: Number(r.unmastered) || 0,
    }));

  return { data: stats, error: null };
};

/**
 * Pull a batch of unmastered questions for the given difficulty.
 * Server caps and randomizes.
 */
export const getUnmasteredQuestions = async (
  userId: string,
  difficulty: ChallengeDifficulty,
  limit: number
): Promise<{ data: Question[] | null; error: any }> => {
  const { data, error } = await supabase.rpc('get_unmastered_questions', {
    p_user_id: userId,
    p_difficulty: difficulty,
    p_limit: limit,
  });

  if (error) {
    console.error('Error fetching unmastered questions:', error);
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
