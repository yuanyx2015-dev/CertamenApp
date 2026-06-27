import { supabase } from '../lib/supabase';

export type QuestionCategory =
  | 'mythology'
  | 'history'
  | 'language'
  | 'literature'
  | 'culture-life'
  | 'living-latin';

export interface Question {
  id: string;
  question_text: string;
  correct_answer: string;
  /** Exactly three distractors (schema v2). */
  wrong_answers: [string, string, string];
  category: QuestionCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  mastery_rank?: number | null;
  pool_order?: number | null;
  block_label?: string | null;
  confidence?: 'high' | 'web-verified' | 'medium-spot-check' | null;
  yale_attestation?: string | null;
  batch_id?: string | null;
  times_asked?: number;
  times_correct?: number;
  created_at?: string;
  updated_at?: string;
}

// Get random questions by category and difficulty
export const getRandomQuestions = async (
  category?: string,
  difficulty?: string,
  limit: number = 10
) => {
  const { data, error } = await supabase.rpc('get_random_questions', {
    p_category: category || null,
    p_difficulty: difficulty || null,
    p_limit: limit, // Matches the actual SQL function parameter name
  });

  if (error) {
    console.error('Error fetching random questions:', error);
    return { data: null, error };
  }

  return { data, error: null };
};
