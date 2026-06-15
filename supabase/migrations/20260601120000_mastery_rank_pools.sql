-- =====================================================================
-- Mastery rank question pools (Challenge Mode)
--
-- Before running, verify your question bank in the SQL editor:
--
--   SELECT COUNT(*) AS total,
--          COUNT(*) FILTER (WHERE difficulty = 'easy') AS easy,
--          COUNT(*) FILTER (WHERE difficulty = 'medium') AS medium,
--          COUNT(*) FILTER (WHERE difficulty = 'hard') AS hard
--   FROM public.questions;
--
-- Challenge expects up to 1,100 questions (11 ranks × 100). The first
-- 1,100 rows (ordered easy → medium → hard, then category, created_at, id)
-- receive fixed rank slots. Extras are left unassigned (NULL rank) and
-- excluded from Challenge pools.
-- =====================================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS mastery_rank SMALLINT,
  ADD COLUMN IF NOT EXISTS pool_order SMALLINT;

COMMENT ON COLUMN public.questions.mastery_rank IS
  'Challenge rank index 0..10 (Miles .. Legatus Legionis). NULL = not in Challenge pool.';
COMMENT ON COLUMN public.questions.pool_order IS
  'Fixed position 1..100 within mastery_rank. Lower = served first when unseen.';

-- Deterministic assignment: first 1,100 questions → 11 ranks of 100.
WITH numbered AS (
  SELECT
    q.id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE q.difficulty
          WHEN 'easy' THEN 0
          WHEN 'medium' THEN 1
          WHEN 'hard' THEN 2
          ELSE 3
        END,
        q.category,
        q.created_at NULLS LAST,
        q.id
    ) AS rn
  FROM public.questions q
)
UPDATE public.questions q
SET
  mastery_rank = LEAST(FLOOR((n.rn - 1) / 100)::SMALLINT, 10),
  pool_order = ((n.rn - 1) % 100) + 1
FROM numbered n
WHERE q.id = n.id
  AND n.rn <= 1100;

CREATE UNIQUE INDEX IF NOT EXISTS questions_mastery_rank_pool_order_unique
  ON public.questions (mastery_rank, pool_order)
  WHERE mastery_rank IS NOT NULL AND pool_order IS NOT NULL;

CREATE INDEX IF NOT EXISTS questions_mastery_rank_idx
  ON public.questions (mastery_rank)
  WHERE mastery_rank IS NOT NULL;


-- =====================================================================
-- get_rank_stats — per-rank totals for Challenge / Profile UI
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_rank_stats(p_user_id UUID)
RETURNS TABLE (
  rank_index INTEGER,
  total_questions BIGINT,
  mastered BIGINT,
  wrong BIGINT,
  unmastered BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH rank_totals AS (
    SELECT q.mastery_rank AS rank_index, COUNT(*)::BIGINT AS total
    FROM public.questions q
    WHERE q.mastery_rank IS NOT NULL
    GROUP BY q.mastery_rank
  ),
  mastered_counts AS (
    SELECT q.mastery_rank AS rank_index, COUNT(*)::BIGINT AS cnt
    FROM public.user_mastered_answers uma
    JOIN public.questions q ON q.id = uma.question_id
    WHERE uma.user_id = p_user_id
      AND q.mastery_rank IS NOT NULL
    GROUP BY q.mastery_rank
  ),
  wrong_counts AS (
    SELECT q.mastery_rank AS rank_index, COUNT(*)::BIGINT AS cnt
    FROM public.user_wrong_answers uwa
    JOIN public.questions q ON q.id = uwa.question_id
    WHERE uwa.user_id = p_user_id
      AND q.mastery_rank IS NOT NULL
    GROUP BY q.mastery_rank
  )
  SELECT
    rt.rank_index::INTEGER,
    rt.total,
    COALESCE(mc.cnt, 0) AS mastered,
    COALESCE(wc.cnt, 0) AS wrong,
    GREATEST(rt.total - COALESCE(mc.cnt, 0) - COALESCE(wc.cnt, 0), 0) AS unmastered
  FROM rank_totals rt
  LEFT JOIN mastered_counts mc ON mc.rank_index = rt.rank_index
  LEFT JOIN wrong_counts wc ON wc.rank_index = rt.rank_index
  ORDER BY rt.rank_index;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rank_stats(UUID) TO authenticated;


-- =====================================================================
-- get_rank_pool_questions — fixed-order Challenge pool for one rank
-- Unseen first (pool_order ASC), then passed (passed_at ASC). No RANDOM().
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_rank_pool_questions(
  p_user_id UUID,
  p_rank_index INTEGER,
  p_limit INTEGER
)
RETURNS SETOF public.questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM public.questions q
  LEFT JOIN public.user_passed_answers upa
    ON upa.user_id = p_user_id AND upa.question_id = q.id
  WHERE q.mastery_rank = p_rank_index
    AND NOT EXISTS (
      SELECT 1 FROM public.user_mastered_answers uma
       WHERE uma.user_id = p_user_id AND uma.question_id = q.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_wrong_answers uwa
       WHERE uwa.user_id = p_user_id AND uwa.question_id = q.id
    )
  ORDER BY
    (upa.passed_at IS NULL) DESC,
    CASE WHEN upa.passed_at IS NULL THEN q.pool_order END ASC,
    upa.passed_at ASC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rank_pool_questions(UUID, INTEGER, INTEGER) TO authenticated;
