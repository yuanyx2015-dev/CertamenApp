import { supabase } from '../lib/supabase';

export interface AIExplanationResponse {
  explanation: string;
  clueCount: number;
  error?: string;
}

/**
 * Get an AI-generated explanation for a quiz question
 * @param questionText The full question text (with clues separated by commas)
 * @param correctAnswer The correct answer to the question
 * @returns AI-generated explanation breaking down each clue
 */
export const getQuestionExplanation = async (
  questionText: string,
  correctAnswer: string
): Promise<{ data: AIExplanationResponse | null; error: any }> => {
  try {
    const { data, error } = await supabase.functions.invoke('explain-question', {
      body: {
        questionText,
        correctAnswer,
      },
    });

    if (error) {
      console.error('Error calling explain-question function:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      // Try to read the actual error body from the edge function
      try {
        const context = (error as any)?.context;
        if (context?._bodyBlob || context?._bodyInit) {
          const blob = context._bodyBlob ?? context._bodyInit;
          const text = await new Response(blob).text();
          console.error('Edge function error body:', text);
        }
      } catch (readErr) {
        console.error('Could not read error body:', readErr);
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error getting question explanation:', error);
    console.error('Caught error details:', error.message, error.stack);
    return { data: null, error };
  }
};
