/*
          # [DEFINITIVE] Reset User Profile Creation Trigger
          This script completely resets the function and trigger responsible for creating a user profile upon sign-up. It addresses persistent database errors by implementing Supabase's recommended security best practices.

          ## Query Description: This operation will drop the existing (and potentially misconfigured) `handle_new_user` function and its associated trigger `on_auth_user_created`. It then recreates them with a `SECURITY DEFINER` context and a fixed `search_path`. This ensures the function has the necessary permissions to insert into the `public.profiles` table and resolves the "Function Search Path Mutable" security warning. This is a safe operation and will not affect existing user data.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Drops and recreates function: `public.handle_new_user`
          - Drops and recreates trigger: `on_auth_user_created` on `auth.users`
          - Enables RLS on `public.profiles` and adds standard policies.
          
          ## Security Implications:
          - RLS Status: Enabled on `public.profiles`
          - Policy Changes: Yes, adds policies for viewing and managing own profile.
          - Auth Requirements: The function will run with the permissions of the definer (admin), which is the standard secure practice.
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: Replaces one trigger. Minimal impact, only runs on new user creation.
          - Estimated Impact: Negligible performance impact.
          */

-- 1. Drop existing trigger and function to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function with SECURITY DEFINER and a fixed search_path.
-- This is the standard secure way to create a trigger function in Supabase.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- The function will run with the permissions of the user that created it.
SET search_path = public -- Explicitly set the search path to resolve the security warning.
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

-- 3. Recreate the trigger to call the function after a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. (Optional but Recommended) Ensure RLS is enabled and set up for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Create policies for profiles
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );
