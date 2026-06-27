import { supabase } from '../lib/supabase';
import { Question } from './questionService';

// Extended question type with wrong answer stats
export interface QuestionWithStats extends Question {
  times_wrong?: number;
  times_attempted?: number;
  last_wrong_at?: string;
}

// Category statistics
export interface CategoryStats {
  category: string;
  total_questions: number;
  wrong_questions: number;
}

/**
 * Get statistics for all categories (total questions and wrong questions per category)
 */
export const getCategoryStats = async (userId: string): Promise<{ data: CategoryStats[] | null; error: any }> => {
  try {
    // Supabase RPC expects UUID type, not string
    const { data, error } = await supabase.rpc('get_category_stats', {
      p_user_id: userId as any  // Cast to bypass TypeScript, Supabase will handle UUID conversion
    });

    if (error) {
      console.error('Error fetching category stats:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching category stats:', error);
    return { data: null, error };
  }
};

/**
 * Get all wrong questions for a user in a specific category
 */
export const getWrongQuestionsByCategory = async (
  userId: string,
  category: string,
  limit: number = 100
): Promise<{ data: QuestionWithStats[] | null; error: any }> => {
  try {
    // Supabase RPC expects UUID type, not string
    const { data, error } = await supabase.rpc('get_user_wrong_questions', {
      p_user_id: userId as any,  // Cast to bypass TypeScript, Supabase will handle UUID conversion
      p_category: category,
      p_limit: limit
    });

    if (error) {
      console.error('Error fetching wrong questions:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching wrong questions:', error);
    return { data: null, error };
  }
};

/**
 * Get all wrong questions for a user (all categories)
 */
export const getAllWrongQuestions = async (
  userId: string,
  limit: number = 100
): Promise<{ data: QuestionWithStats[] | null; error: any }> => {
  try {
    // Supabase RPC expects UUID type, not string
    const { data, error } = await supabase.rpc('get_user_wrong_questions', {
      p_user_id: userId as any,  // Cast to bypass TypeScript, Supabase will handle UUID conversion
      p_category: null,
      p_limit: limit
    });

    if (error) {
      console.error('Error fetching all wrong questions:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching all wrong questions:', error);
    return { data: null, error };
  }
};

/**
 * Mark a question as wrong. Uses the atomic mark_wrong_question RPC, which:
 *   - removes it from user_mastered_answers (if present)
 *   - removes it from user_passed_answers (if present)
 *   - upserts into user_wrong_answers, bumping times_wrong / times_attempted / last_wrong_at
 */
export const markQuestionAsWrong = async (
  userId: string,
  questionId: string
): Promise<{ data: any; error: any }> => {
  try {
    const { error } = await supabase.rpc('mark_wrong_question', {
      p_user_id: userId,
      p_question_id: questionId,
    });

    if (error) {
      console.error('Error marking question as wrong (RPC):', error);
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (error: any) {
    console.error('Unexpected error marking question as wrong:', error);
    return { data: null, error };
  }
};

/**
 * Check if a question is marked as wrong for a user
 */
export const isQuestionWrong = async (
  userId: string,
  questionId: string
): Promise<{ data: boolean; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('user_wrong_answers')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found = not wrong
        return { data: false, error: null };
      }
      return { data: false, error };
    }

    return { data: true, error: null };
  } catch (error: any) {
    return { data: false, error };
  }
};
