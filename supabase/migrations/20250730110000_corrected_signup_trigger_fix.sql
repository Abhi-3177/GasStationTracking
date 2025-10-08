/*
  # [DEFINITIVE SIGNUP FIX (Corrected)]
  This script corrects a syntax error in the previous migration and ensures that a user profile is automatically created in the `public.profiles` table whenever a new user signs up in `auth.users`.

  ## Query Description:
  - **DROP Existing Trigger/Function:** It first safely removes the old, potentially faulty `on_auth_user_created` trigger and `handle_new_user` function to prevent conflicts.
  - **CREATE Function:** It then creates a new `handle_new_user` function. This function is designed to run with elevated privileges (`SECURITY DEFINER`) to ensure it can write to the `public.profiles` table. It also sets a secure `search_path`.
  - **CREATE Trigger:** Finally, it creates a trigger that calls this function every time a new row is added to the `auth.users` table.

  This is the standard and secure way to handle automatic profile creation in Supabase and should permanently resolve the "Database error creating new user" issue.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: true (by dropping the created trigger and function)

  ## Security Implications:
  - RLS Status: This does not change RLS policies on your tables.
  - Policy Changes: No.
  - Auth Requirements: The function runs as `SECURITY DEFINER` which is necessary for this operation.
*/

-- 1. Drop the old trigger and function if they exist, to ensure a clean setup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function to handle new user creation.
-- This function will insert a new row into the `public.profiles` table.
CREATE FUNCTION public.handle_new_user()
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

-- 3. Create the trigger that fires after a new user is inserted into auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
