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
 * Get all available question categories
 */
export const getCategories = (): string[] => {
  return ['mythology', 'history', 'language', 'literature', 'life', 'general'];
};

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
 * Get all questions in a specific category
 */
export const getQuestionsByCategory = async (
  category: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ data: Question[] | null; error: any }> => {
  try {
    const { data, error } = await supabase.rpc('get_questions_by_category', {
      p_category: category,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Error fetching questions by category:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching questions by category:', error);
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
 * Mark a question as wrong (add to user_wrong_answers)
 */
export const markQuestionAsWrong = async (
  userId: string,
  questionId: string
): Promise<{ data: any; error: any }> => {
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('user_wrong_answers')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('user_wrong_answers')
        .update({
          times_wrong: existing.times_wrong + 1,
          times_attempted: existing.times_attempted + 1,
          last_wrong_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating wrong answer:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('user_wrong_answers')
        .insert({
          user_id: userId,
          question_id: questionId,
          times_wrong: 1,
          times_attempted: 1,
          last_wrong_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating wrong answer:', error);
        return { data: null, error };
      }

      return { data, error: null };
    }
  } catch (error: any) {
    console.error('Unexpected error marking question as wrong:', error);
    return { data: null, error };
  }
};

/**
 * Mark a question as correct (remove from user_wrong_answers)
 */
export const markQuestionAsCorrect = async (
  userId: string,
  questionId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('user_wrong_answers')
      .delete()
      .eq('user_id', userId)
      .eq('question_id', questionId);

    if (error) {
      console.error('Error removing wrong answer:', error);
      return { error };
    }

    return { error: null };
  } catch (error: any) {
    console.error('Unexpected error marking question as correct:', error);
    return { error };
  }
};

/**
 * Toggle wrong status of a question
 * If question is in wrong_answers, remove it. Otherwise, add it.
 */
export const toggleWrongStatus = async (
  userId: string,
  questionId: string,
  isCurrentlyWrong: boolean
): Promise<{ error: any }> => {
  if (isCurrentlyWrong) {
    return markQuestionAsCorrect(userId, questionId);
  } else {
    const result = await markQuestionAsWrong(userId, questionId);
    return { error: result.error };
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

/**
 * Search questions by text (across all categories or specific category)
 */
export const searchQuestions = async (
  searchTerm: string,
  category?: string,
  limit: number = 50
): Promise<{ data: Question[] | null; error: any }> => {
  try {
    let query = supabase
      .from('questions')
      .select('*')
      .ilike('question_text', `%${searchTerm}%`);

    if (category) {
      query = query.eq('category', category);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error searching questions:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Unexpected error searching questions:', error);
    return { data: null, error };
  }
};
