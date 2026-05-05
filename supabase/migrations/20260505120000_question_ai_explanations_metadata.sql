-- Denormalized question snapshot for analytics / Table Editor readability (source of truth remains questions.id).
ALTER TABLE public.question_ai_explanations
  ADD COLUMN IF NOT EXISTS question_text TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS correct_answer TEXT;

COMMENT ON COLUMN public.question_ai_explanations.question_text IS 'Snapshot of questions.question_text when explanation was generated.';
COMMENT ON COLUMN public.question_ai_explanations.category IS 'Snapshot of questions.category when explanation was generated.';
COMMENT ON COLUMN public.question_ai_explanations.difficulty IS 'Snapshot of questions.difficulty when explanation was generated.';
COMMENT ON COLUMN public.question_ai_explanations.correct_answer IS 'Snapshot of questions.correct_answer when explanation was generated.';
