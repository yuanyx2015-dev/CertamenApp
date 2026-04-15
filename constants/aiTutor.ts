/** Must match `SQL stuff/ai_tutor_usage.sql` and `supabase/functions/ai-tutor/index.ts`. */
export const AI_TUTOR_DAILY_LIMIT = 2;
export const AI_TUTOR_MAX_QUESTION_CHARS = 500;

/** Full prompt sent to the ai-tutor Edge Function from category review follow-ups. */
export function buildContextualTutorPrompt(
  questionText: string,
  correctAnswer: string,
  userFollowUp: string
): string {
  return `Regarding this Certamen question: "${questionText}" (Answer: "${correctAnswer}")

User asks: ${userFollowUp}

Please answer the user's question specifically about this question.`;
}

/** Max length of the user's follow-up so the composed prompt stays within the Edge Function limit. */
export function maxFollowUpCharsForContext(
  questionText: string,
  correctAnswer: string
): number {
  const baseLen = buildContextualTutorPrompt(questionText, correctAnswer, '').length;
  return Math.max(0, AI_TUTOR_MAX_QUESTION_CHARS - baseLen);
}
