-- Mastered questions for the Practice "Mastered" pool.
--
-- Mirrors get_user_wrong_questions: joins the user's list to live questions rows
-- and returns them in one call. SECURITY DEFINER so the client never needs a
-- direct read on public.questions, and a server-side join so the caller doesn't
-- have to send every mastered id back as a filter.
CREATE OR REPLACE FUNCTION public.get_user_mastered_questions(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 1200
)
RETURNS TABLE (
  id UUID,
  question_text TEXT,
  correct_answer TEXT,
  wrong_answers TEXT[],
  category TEXT,
  difficulty TEXT,
  mastered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.correct_answer,
    q.wrong_answers,
    q.category,
    q.difficulty,
    uma.mastered_at
  FROM public.questions q
  INNER JOIN public.user_mastered_answers uma ON uma.question_id = q.id
  WHERE uma.user_id = p_user_id
    AND (p_category IS NULL OR q.category = p_category)
  ORDER BY uma.mastered_at DESC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_mastered_questions(UUID, TEXT, INTEGER) TO authenticated;
