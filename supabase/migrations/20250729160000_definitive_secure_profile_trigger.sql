/*
          # [DEFINITIVE SECURE PROFILE TRIGGER]
          This script completely resets the user profile creation mechanism. It drops the old trigger and function, then recreates them following the latest Supabase security best practices. This is the definitive fix for the "Database error creating new user" issue.

          ## Query Description: [This operation will replace the core function responsible for creating user profiles upon sign-up. It is designed to be safe and will not affect existing user data. It ensures that all new users created via the sign-up form will have a corresponding profile entry, fixing the persistent database error.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Drops and recreates the `handle_new_user` function.
          - Drops and recreates the `on_auth_user_created` trigger on the `auth.users` table.
          
          ## Security Implications:
          - RLS Status: [Not Applicable]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          - **Enhancement**: The new function uses `SECURITY DEFINER` and sets a static `search_path`. This is a critical security and stability improvement that resolves the "Function Search Path Mutable" warning.
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [Replaced]
          - Estimated Impact: [Negligible. This trigger only runs once upon user creation.]
          */

-- 1. Drop the old trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function that will be called by the trigger.
-- This function is responsible for creating a new row in the public.profiles table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY DEFINER: This is crucial. It makes the function execute with the permissions of the user who defined it (the 'postgres' superuser), not the user who invokes it. This gives it the necessary permissions to insert into the public.profiles table.
SECURITY DEFINER
-- SET search_path: This is the definitive fix for the security warning. It forces the function to only look in the 'public' schema, preventing any ambiguity or potential for malicious path manipulation.
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into the public.profiles table.
  -- It uses the `id` from the newly created user in `auth.users`.
  -- It also pulls the `full_name` from the `raw_user_meta_data` JSON field that we pass during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;

-- 3. Create the trigger that calls the function.
-- This trigger fires automatically AFTER a new user is inserted into the `auth.users` table.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant execute permission on the function to the 'service_role'
-- This is a best practice to ensure Supabase internal services can correctly call the function.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
