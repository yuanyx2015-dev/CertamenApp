-- One player pressing Next waits 5 seconds, then the next question starts.
-- The other player pressing Next in that window starts it immediately.
-- The wait is not shown in the app.

CREATE OR REPLACE FUNCTION public.arena_tap_next(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.phase <> 'scoreboard' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The score page is not up.');
  END IF;

  IF m.host_id = v_uid AND NOT m.host_next THEN
    UPDATE public.arena_matches
    SET host_next = true,
        next_deadline = COALESCE(next_deadline, clock_timestamp() + interval '5 seconds')
    WHERE id = m.id;
  ELSIF m.guest_id = v_uid AND NOT m.guest_next THEN
    UPDATE public.arena_matches
    SET guest_next = true,
        next_deadline = COALESCE(next_deadline, clock_timestamp() + interval '5 seconds')
    WHERE id = m.id;
  END IF;

  PERFORM public.arena_maybe_advance(m.id);
  RETURN jsonb_build_object('ok', true);
END;
$$;
