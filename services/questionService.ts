import { supabase } from '../lib/supabase';

export interface Question {
  id: string;
  question_text: string;
  correct_answer: string;
  wrong_answers: string[];
  category: 'mythology' | 'history' | 'language' | 'literature' | 'life' | 'general';
  difficulty: 'easy' | 'medium' | 'hard';
  times_asked: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
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
    p_limit: limit
  });

  if (error) {
    console.error('Error fetching random questions:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Get a specific question by ID
export const getQuestion = async (id: string) => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching question:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Get all questions (with optional filters)
export const getQuestions = async (filters?: {
  category?: string;
  difficulty?: string;
  limit?: number;
}) => {
  let query = supabase
    .from('questions')
    .select('*');

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching questions:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Create a new question
export const createQuestion = async (question: Omit<Question, 'id' | 'created_at' | 'updated_at' | 'times_asked' | 'times_correct'>) => {
  const { data, error } = await supabase
    .from('questions')
    .insert(question)
    .select()
    .single();

  if (error) {
    console.error('Error creating question:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Update a question
export const updateQuestion = async (id: string, updates: Partial<Question>) => {
  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating question:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Delete a question
export const deleteQuestion = async (id: string) => {
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting question:', error);
    return { error };
  }

  return { error: null };
};

// Increment times_asked counter
export const incrementTimesAsked = async (id: string) => {
  const { data, error } = await supabase
    .from('questions')
    .update({ times_asked: supabase.raw('times_asked + 1') })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error incrementing times_asked:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Increment times_correct counter
export const incrementTimesCorrect = async (id: string) => {
  const { data, error } = await supabase
    .from('questions')
    .update({ times_correct: supabase.raw('times_correct + 1') })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error incrementing times_correct:', error);
    return { data: null, error };
  }

  return { data, error: null };
};
