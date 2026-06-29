-- Exact count of reviewable wrong questions (joins to live questions rows only).
-- Matches get_user_wrong_questions / the review game pool.
CREATE OR REPLACE FUNCTION public.get_wrong_count(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.user_wrong_answers uwa
  INNER JOIN public.questions q ON q.id = uwa.question_id
  WHERE uwa.user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_wrong_count(UUID) TO authenticated;
