/*
# [Definitive Profile Creation Trigger Reset]
This script completely resets the function and trigger responsible for creating a user profile after sign-up. It addresses persistent permission errors and security warnings by implementing the standard, secure Supabase pattern for this task.

## Query Description: "This operation will drop and recreate the user profile creation mechanism. It is a safe and necessary fix for the sign-up process and will not affect existing user data. It also resolves a known security warning."

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- Drops function: `public.handle_new_user`
- Drops trigger: `on_auth_user_created` on `auth.users`
- Recreates function: `public.handle_new_user` with `SECURITY DEFINER` and a fixed `search_path`.
- Recreates trigger: `on_auth_user_created` on `auth.users` to call the new function.

## Security Implications:
- RLS Status: [Unaffected]
- Policy Changes: [No]
- Auth Requirements: [None]
- This script resolves the "Function Search Path Mutable" security warning.

## Performance Impact:
- Indexes: [Unaffected]
- Triggers: [Replaced]
- Estimated Impact: [Negligible. Affects only new user creation.]
*/

-- Step 1: Drop the existing trigger and function to ensure a clean state.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Step 2: Create the function to handle new user creation.
-- This function runs with the permissions of the definer (the admin running this script),
-- which allows it to insert into the public.profiles table.
-- The search_path is explicitly set to 'public' to resolve security warnings and ensure stability.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, linking it to the new user.
  -- It pulls the 'full_name' from the metadata provided during the sign-up process.
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  
  RETURN new;
END;
$$;

-- Step 3: Create the trigger that fires after a new user is inserted into auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Grant usage on the public schema to the authenticated role.
-- This ensures that authenticated users can interact with the schema as needed.
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 5: Grant necessary permissions on the profiles table to the authenticated role.
-- This allows authenticated users to select, insert, update, and delete their own profiles (assuming RLS is in place).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
