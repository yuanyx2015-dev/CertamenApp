-- Wipe all per-user data on account deletion, including tables keyed by auth.users.id
-- and any legacy profiles rows matched by email.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_email text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = current_user_id;

  DELETE FROM public.user_mastered_answers WHERE user_id = current_user_id;
  DELETE FROM public.user_passed_answers WHERE user_id = current_user_id;
  DELETE FROM public.user_wrong_answers WHERE user_id = current_user_id;
  DELETE FROM public.user_stats WHERE user_id = current_user_id;
  DELETE FROM public.ai_tutor_usage WHERE user_id = current_user_id::text;

  DELETE FROM public.profiles WHERE id = current_user_id;

  IF user_email IS NOT NULL THEN
    DELETE FROM public.profiles WHERE lower(email) = lower(user_email);
  END IF;

  DELETE FROM auth.users WHERE id = current_user_id;

  RETURN json_build_object('success', true, 'message', 'Account deleted successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
