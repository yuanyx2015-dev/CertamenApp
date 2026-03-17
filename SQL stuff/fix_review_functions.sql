-- ================================================
-- DEFINITIVE FIX FOR REVIEW FUNCTIONS
-- This fixes the UUID vs TEXT type mismatch errors
-- ================================================

-- 1. Drop all existing versions of these functions
DROP FUNCTION IF EXISTS public.get_category_stats(TEXT);
DROP FUNCTION IF EXISTS public.get_category_stats(UUID);
DROP FUNCTION IF EXISTS public.get_user_wrong_questions(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_user_wrong_questions(UUID, TEXT, INTEGER);

-- 2. Create get_category_stats with proper UUID handling
CREATE OR REPLACE FUNCTION public.get_category_stats(
  p_user_id UUID
)
RETURNS TABLE (
  category TEXT,
  total_questions BIGINT,
  wrong_questions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.category,
    COUNT(DISTINCT q.id) as total_questions,
    COUNT(DISTINCT CASE 
      WHEN uwa.user_id = p_user_id AND uwa.question_id = q.id 
      THEN q.id 
    END) as wrong_questions
  FROM public.questions q
  LEFT JOIN public.user_wrong_answers uwa 
    ON uwa.question_id = q.id AND uwa.user_id = p_user_id
  GROUP BY q.category
  ORDER BY q.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create get_user_wrong_questions with proper UUID handling
CREATE OR REPLACE FUNCTION public.get_user_wrong_questions(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  question_text TEXT,
  correct_answer TEXT,
  wrong_answers TEXT[],
  category TEXT,
  difficulty TEXT,
  times_wrong INTEGER,
  times_attempted INTEGER,
  last_wrong_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.question_text,
    q.correct_answer,
    q.wrong_answers,
    q.category,
    q.difficulty,
    uwa.times_wrong,
    uwa.times_attempted,
    uwa.last_wrong_at
  FROM public.questions q
  INNER JOIN public.user_wrong_answers uwa ON uwa.question_id = q.id
  WHERE uwa.user_id = p_user_id
    AND (p_category IS NULL OR q.category = p_category)
  ORDER BY uwa.last_wrong_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_category_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_wrong_questions(UUID, TEXT, INTEGER) TO authenticated;
