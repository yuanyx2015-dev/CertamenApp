-- Random match and Start the match both draw questions through this function.
-- arena_playable_ids returns a set of uuid values, not rows with an id column,
-- so SELECT id failed with: column "id" does not exist.

CREATE OR REPLACE FUNCTION public.arena_pick_questions(p_settings jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cats text[];
  v_diffs text[];
  v_want integer;
  v_available integer;
  v_n integer;
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO v_cats
  FROM jsonb_array_elements_text(p_settings->'categories') AS t(value);
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO v_diffs
  FROM jsonb_array_elements_text(p_settings->'difficulties') AS t(value);
  v_want := (p_settings->>'question_count')::integer;
  SELECT count(*)::integer INTO v_available FROM public.arena_playable_ids(v_cats, v_diffs) AS id;
  IF v_available < 5 OR v_want IS NULL OR v_want < 5 THEN
    RETURN NULL;
  END IF;
  v_n := least(v_want, 50, v_available);
  SELECT COALESCE(array_agg(s.id ORDER BY s.ord), ARRAY[]::uuid[])
    INTO v_ids
  FROM (
    SELECT shuffled.id, row_number() OVER () AS ord
    FROM (
      SELECT playable.id
      FROM public.arena_playable_ids(v_cats, v_diffs) AS playable(id)
      ORDER BY random()
      LIMIT v_n
    ) AS shuffled
  ) AS s;
  IF cardinality(v_ids) < 5 THEN
    RETURN NULL;
  END IF;
  RETURN v_ids;
END;
$$;
