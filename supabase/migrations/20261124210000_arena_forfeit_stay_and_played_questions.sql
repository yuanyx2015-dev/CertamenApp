-- Forfeit ends the match, but the player is still on the result screen.
-- They stay available for Play again until they tap Leave the match.
-- The review lists only questions that were finished.

CREATE OR REPLACE FUNCTION public.arena_finish(p_match_id uuid, p_result text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
  v_done integer;
BEGIN
  SELECT * INTO m
  FROM public.arena_matches
  WHERE id = p_match_id
  FOR UPDATE;
  IF NOT FOUND OR m.stats_applied OR m.status = 'finished' THEN
    RETURN;
  END IF;
  IF m.status NOT IN ('countdown', 'live') THEN
    RETURN;
  END IF;

  IF p_result IN ('host_forfeit', 'guest_forfeit', 'double_forfeit') THEN
    IF m.phase IN ('reveal', 'scoreboard') THEN
      v_done := LEAST(m.q_index + 1, m.q_count);
    ELSE
      v_done := m.q_index;
    END IF;
  ELSE
    v_done := m.q_count;
  END IF;

  IF p_result = 'host_win' THEN
    PERFORM public.arena_add_stat(m.host_id, 1, 1, 0, 0, false);
    PERFORM public.arena_add_stat(m.guest_id, 0, 1, 0, 0, false);
  ELSIF p_result = 'guest_win' THEN
    PERFORM public.arena_add_stat(m.guest_id, 1, 1, 0, 0, false);
    PERFORM public.arena_add_stat(m.host_id, 0, 1, 0, 0, false);
  ELSIF p_result = 'tie' THEN
    PERFORM public.arena_add_stat(m.host_id, 0, 0, 1, 0, false);
    PERFORM public.arena_add_stat(m.guest_id, 0, 0, 1, 0, false);
  ELSIF p_result = 'host_forfeit' THEN
    PERFORM public.arena_add_stat(m.host_id, 0, 1, 0, 1, true);
    PERFORM public.arena_add_stat(m.guest_id, 1, 1, 0, 0, false);
  ELSIF p_result = 'guest_forfeit' THEN
    PERFORM public.arena_add_stat(m.guest_id, 0, 1, 0, 1, true);
    PERFORM public.arena_add_stat(m.host_id, 1, 1, 0, 0, false);
  ELSIF p_result = 'double_forfeit' THEN
    PERFORM public.arena_add_stat(m.host_id, 0, 1, 0, 1, true);
    PERFORM public.arena_add_stat(m.guest_id, 0, 1, 0, 1, true);
  ELSE
    RETURN;
  END IF;

  UPDATE public.arena_matches
  SET status = 'finished',
      phase = 'final',
      result = p_result,
      stats_applied = true,
      finished_at = clock_timestamp(),
      q_index = v_done,
      host_rematch = false,
      guest_rematch = false,
      next_deadline = NULL
  WHERE id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_review(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.status <> 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The review opens when the match is over.');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY ord), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      u.ord,
      jsonb_build_object(
        'question_text', q.question_text,
        'choices', jsonb_build_array(
          jsonb_build_object('text', trim(q.correct_answer), 'correct', true),
          jsonb_build_object('text', trim(q.wrong_answers[1]), 'correct', false),
          jsonb_build_object('text', trim(q.wrong_answers[2]), 'correct', false),
          jsonb_build_object('text', trim(q.wrong_answers[3]), 'correct', false)
        )
      ) AS row_data
    FROM public.arena_match_secrets s
    CROSS JOIN LATERAL unnest(s.question_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.questions q ON q.id = u.id
    WHERE s.match_id = m.id
      AND u.ord <= CASE
        WHEN m.result IN ('host_forfeit', 'guest_forfeit', 'double_forfeit') THEN m.q_index
        ELSE m.q_count
      END
  ) listed;

  RETURN jsonb_build_object(
    'ok', true,
    'result', m.result,
    'host_name', m.host_name,
    'guest_name', m.guest_name,
    'host_score', m.host_score,
    'guest_score', m.guest_score,
    'questions', v_rows
  );
END;
$$;
