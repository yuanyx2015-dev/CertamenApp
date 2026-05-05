import { supabase } from '../lib/supabase';

export interface AIExplanationResponse {
  explanation: string;
  clueCount: number;
  /** True when returned from DB cache (no Gemini call). */
  cached?: boolean;
  /** Which Gemini model produced this text (see Edge Function model chain). */
  geminiModelUsed?: string | null;
  /** Row was rewritten using the preferred (best) model. */
  upgraded?: boolean;
  upgradeAttempted?: boolean;
  upgradeFailed?: boolean;
  upgradeSkipped?: boolean;
  /** Present when saving the new explanation to DB failed (check deploy / FK). */
  persistError?: string | null;
  error?: string;
}

/**
 * Get an AI-generated explanation for a quiz question.
 * The edge function caches by `questionId` so repeat requests skip Gemini.
 */
export const getQuestionExplanation = async (
  questionText: string,
  correctAnswer: string,
  questionId: string
): Promise<{ data: AIExplanationResponse | null; error: any }> => {
  try {
    const { data, error } = await supabase.functions.invoke('explain-question', {
      body: {
        questionText,
        correctAnswer,
        questionId,
      },
    });

    if (data && typeof data === 'object' && 'persistError' in data && (data as AIExplanationResponse).persistError) {
      console.warn(
        '[AI explanation] Not saved to question_ai_explanations:',
        (data as AIExplanationResponse).persistError
      );
    }

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
