-- Cached AI explanations per question (shared across users; reduces Gemini calls).
CREATE TABLE IF NOT EXISTS public.question_ai_explanations (
  question_id UUID PRIMARY KEY REFERENCES public.questions (id) ON DELETE CASCADE,
  explanation_text TEXT NOT NULL,
  explain_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS question_ai_explanations_updated_idx
  ON public.question_ai_explanations (updated_at DESC);

COMMENT ON TABLE public.question_ai_explanations IS
  'Stores one Gemini explanation per question; explain_count increments each time Explain with AI is used.';

ALTER TABLE public.question_ai_explanations ENABLE ROW LEVEL SECURITY;

-- Edge Function uses service_role (bypasses RLS). Optional read for debugging via SQL editor only.

-- Atomic increment when serving a cached explanation (edge function).
CREATE OR REPLACE FUNCTION public.increment_ai_explanation_usage(p_question_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.question_ai_explanations
  SET
    explain_count = explain_count + 1,
    updated_at = NOW()
  WHERE question_id = p_question_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_explanation_usage(UUID) TO service_role;