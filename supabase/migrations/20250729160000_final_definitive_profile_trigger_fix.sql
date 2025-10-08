/*
          # [DEFINITIVE FIX] Reset and Recreate User Profile Trigger
          This script provides a final, robust fix for the "Database error creating new user" issue.
          It completely removes any previous, potentially misconfigured triggers or functions
          and recreates them according to the latest Supabase security best practices.

          ## Query Description:
          This operation is safe and will not affect any existing user data. It only modifies the
          automated mechanism for creating new user profiles. It drops the old trigger and function
          and creates new ones that are more secure and reliable. This script is designed to be
          run multiple times without causing errors.

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: false

          ## Security Implications:
          - RLS Status: Not directly affected, but this enables profile creation which is a prerequisite for RLS on profiles.
          - Policy Changes: No
          - Auth Requirements: Must be run by an admin.
          - **Fixes Security Warning:** This script resolves the "Function Search Path Mutable" warning by explicitly setting the search_path.
*/

-- 1. Drop the old trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function to handle new user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- IMPORTANT: Set a stable search path to prevent search path hijacking and fix the security warning.
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, taking the user's ID and full name from the auth.users table.
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

-- 3. Create the trigger that fires after a new user is created in the auth.users table.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
