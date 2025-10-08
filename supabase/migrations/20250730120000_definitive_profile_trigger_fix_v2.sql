-- Supabase Trigger and Function for Profile Creation
-- This script ensures that a new profile is created in the `public.profiles` table
-- automatically whenever a new user signs up in the `auth.users` table.

-- Step 1: Clean up old versions
-- Drop the existing trigger and function if they exist to ensure a fresh start.
-- This is safe to run even if they don't exist.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create the profile creation function
/*
  # Function: handle_new_user
  This function is triggered after a new user is inserted into the `auth.users` table.
  It creates a corresponding entry in the `public.profiles` table.

  ## Query Description:
  This operation sets up an automated process. It is non-destructive and only affects new user sign-ups.
  There is no risk to existing user data.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true (by dropping the trigger and function)

  ## Security Implications:
  - RLS Status: This function runs with the permissions of its owner (`SECURITY DEFINER`),
    allowing it to insert into `public.profiles` which is a secure practice.
  - Policy Changes: No
  - Auth Requirements: The function is triggered by the Supabase auth system.
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- This is crucial for allowing the trigger to write to the public schema.
SET search_path = public -- This explicitly sets the search path, resolving the security warning.
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, linking it to the new user.
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id, -- The user's ID from the auth.users table
    new.raw_user_meta_data->>'full_name' -- The full_name provided during sign-up
  );
  RETURN new;
END;
$$;

-- Step 3: Create the trigger
-- This trigger calls the `handle_new_user` function after every new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Add comments for clarity in the Supabase dashboard
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates a new user profile upon sign-up.';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Fires after a new user is created to set up their profile.';
