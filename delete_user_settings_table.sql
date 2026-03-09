-- SQL Script to delete user_settings table from Supabase
-- IMPORTANT: Only run this AFTER all your users have logged in at least once
-- with the new code that migrates their settings to localStorage

-- WARNING: This will permanently delete all user_settings data from Supabase
-- Make sure the migration has run for all active users first!

-- Step 1: Drop all policies on the table
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
-- Add any other policies you may have created

-- Step 2: Drop any triggers on the table
DROP TRIGGER IF EXISTS set_user_settings_updated_at ON public.user_settings;

-- Step 3: Drop any functions specific to user_settings (if any)
DROP FUNCTION IF EXISTS public.handle_user_settings_updated_at();

-- Step 4: Drop the table
DROP TABLE IF EXISTS public.user_settings;

-- Verification: List all tables to confirm deletion
-- Run this after to verify:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
