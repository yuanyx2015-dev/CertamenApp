-- Records which Gemini model produced the cached explanation (for upgrade-on-explain logic).
ALTER TABLE public.question_ai_explanations
  ADD COLUMN IF NOT EXISTS gemini_model TEXT;

COMMENT ON COLUMN public.question_ai_explanations.gemini_model IS
  'Model id used for explanation_text, e.g. gemini-2.5-flash. Chain order defined by Edge Function env.';
