import { supabase } from '../lib/supabase';

/**
 * Record that a user answered a question correctly but did NOT master it.
 * Server (record_passed_question RPC) removes the question from mastered/wrong
 * tables and upserts into user_passed_answers with passed_at = NOW(),
 * which guarantees the question queues to the BACK of the unmastered pool.
 */
export const recordPassedQuestion = async (userId: string, questionId: string) => {
  const { error } = await supabase.rpc('record_passed_question', {
    p_user_id: userId,
    p_question_id: questionId,
  });

  if (error) {
    console.error('Error recording passed question:', error);
  }

  return { error };
};

/**
 * Count of passed questions for the user (right-but-not-mastered, all difficulties).
 * Mostly for debugging / future UI.
 */
export const getPassedCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('user_passed_answers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return { data: 0, error };
  }
  return { data: count ?? 0, error: null };
};
