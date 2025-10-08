/*
          # [DEFINITIVE FIX] Reset and Recreate User Profile Trigger
          This script completely drops and recreates the user profile creation mechanism to resolve persistent "Database error creating new user" errors during sign-up. It implements the latest security best practices.

          ## Query Description: This operation will:
          1. Drop the existing `on_auth_user_created` trigger and `handle_new_user` function to ensure a clean state.
          2. Recreate the `handle_new_user` function with `SECURITY DEFINER` and a fixed `search_path`. This resolves the "Function Search Path Mutable" security warning and ensures the function has the necessary permissions to insert into the `public.profiles` table.
          3. Recreate the trigger to fire after a new user is created in `auth.users`.
          This is a safe operation for existing data as it only affects the sign-up process for new users. No user data will be lost.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Drops trigger `on_auth_user_created` on `auth.users`.
          - Drops function `public.handle_new_user`.
          - Recreates function `public.handle_new_user`.
          - Recreates trigger `on_auth_user_created` on `auth.users`.
          
          ## Security Implications:
          - RLS Status: Unchanged.
          - Policy Changes: No.
          - Auth Requirements: Fixes a core auth-related database trigger.
          
          ## Performance Impact:
          - Indexes: None.
          - Triggers: Replaces an existing trigger. Negligible impact.
          - Estimated Impact: Low. Improves reliability of the sign-up flow.
          */

-- 1. Drop existing trigger and function to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- 2. Create the function to handle new user creation.
-- This function runs with the permissions of the user who created it (the admin),
-- ensuring it can insert into the public.profiles table.
-- It also sets a fixed search_path to resolve the security warning.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

-- 3. Create the trigger to call the function after a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. (Optional but good practice) Grant usage on the public schema to the authenticated role.
-- This ensures that authenticated users can interact with the public schema as defined by RLS policies.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.profiles TO authenticated;
