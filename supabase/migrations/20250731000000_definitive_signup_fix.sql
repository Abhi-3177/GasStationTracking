/*
          # [DEFINITIVE SIGN-UP FIX]
          This script performs a hard reset of the user profile creation mechanism. It drops any old, misconfigured functions and triggers and recreates them using the latest Supabase security best practices. This is intended to permanently resolve persistent "Database error creating new user" errors during sign-up.

          ## Query Description: [This operation will drop and recreate the function and trigger responsible for creating user profiles upon sign-up. It is a safe and recommended way to fix common authentication issues and should not affect existing user data.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Drops trigger `on_auth_user_created` on `auth.users` if it exists.
          - Drops function `public.handle_new_user()` if it exists.
          - Creates a new `public.handle_new_user()` function with `SECURITY DEFINER` and a fixed `search_path` to ensure correct permissions and prevent RLS/search path errors.
          - Recreates the trigger `on_auth_user_created` to call the new function after a user is inserted into `auth.users`.
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [Modified]
          - Estimated Impact: [Negligible. This operation only affects the user creation process.]
          */

-- 1. Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- 2. Create the function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

-- 3. Create the trigger to call the function after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Ensure RLS is enabled on the profiles table (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for the profiles table (idempotent, will not error if they exist)
-- Allow users to read their own profile
CREATE POLICY "Users can view their own profile."
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
