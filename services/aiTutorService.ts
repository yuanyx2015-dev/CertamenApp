import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

export interface AITutorResponse {
  answer: string;
  remainingQuestions: number;
  error?: string;
  limitReached?: boolean;
  message?: string;
}

export interface UsageInfo {
  question_count: number;
  remaining_questions: number;
}

/**
 * Get current AI tutor usage for today
 * @param userId User ID
 * @returns Usage information (questions asked today and remaining)
 */
export const getAITutorUsage = async (
  userId: string
): Promise<{ data: UsageInfo | null; error: any }> => {
  try {
    const { data, error } = await supabase.rpc('get_ai_tutor_usage', {
      p_user_id: userId as any,
    });

    if (error) {
      console.error('Error getting AI tutor usage:', error);
      return { data: null, error };
    }

    return { data: data?.[0] || null, error: null };
  } catch (error: any) {
    console.error('Error getting AI tutor usage:', error);
    return { data: null, error };
  }
};

/**
 * Ask the AI tutor a question
 * @param userId User ID
 * @param question The question to ask
 * @returns AI-generated answer and remaining questions
 */
export const askAITutor = async (
  userId: string,
  question: string
): Promise<{ data: AITutorResponse | null; error: any }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ai-tutor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId, question }),
      }
    );

    const data = await response.json();
    console.log(data);

    if (!response.ok) {
      const err = data.error ?? 'Request failed';
      console.error('Error calling ai-tutor function:', err);
      return { data: null, error: err };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error asking AI tutor:', error);
    return { data: null, error };
  }
};
