-- ================================================
-- Function to delete user account completely
-- This should be run with SECURITY DEFINER so it has
-- permission to delete from auth.users
-- ================================================

-- First, create a function to delete the user
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  result json;
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  
  -- Log the deletion attempt
  RAISE NOTICE 'Attempting to delete account for user: %', current_user_id;
  
  -- Delete from ai_tutor_usage table (uses TEXT user_id)
  DELETE FROM public.ai_tutor_usage WHERE user_id = current_user_id::text;
  
  -- Delete from profiles table (this will CASCADE to user_stats and user_wrong_answers)
  DELETE FROM public.profiles WHERE id = current_user_id;
  
  -- Delete from auth.users (this requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = current_user_id;
  
  -- Return success
  RETURN json_build_object('success', true, 'message', 'Account deleted successfully');
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error deleting account: %', SQLERRM;
    RETURN json_build_object('error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- ================================================
-- USAGE:
-- Call this function from your app:
-- const { data, error } = await supabase.rpc('delete_user_account')
-- ================================================
