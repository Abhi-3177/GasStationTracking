/*
          # [DEFINITIVE FIX] Reset User Profile Creation Trigger
          This script completely resets the function and trigger responsible for creating a user profile in the 'public.profiles' table after a new user signs up in 'auth.users'. It is designed to be a definitive fix for "Database error creating new user" issues by resolving underlying permission and search_path problems.

          ## Query Description: This operation will drop and recreate the 'handle_new_user' function and its associated trigger 'on_auth_user_created'. It ensures the function runs with the correct permissions (SECURITY DEFINER) and in the correct schema context ('public'), which also resolves the "Function Search Path Mutable" security warning. This will not affect any existing user data in the 'auth.users' or 'public.profiles' tables.
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Drops trigger 'on_auth_user_created' on table 'auth.users'.
          - Drops function 'public.handle_new_user'.
          - Recreates function 'public.handle_new_user' with 'SECURITY DEFINER'.
          - Sets a fixed 'search_path' for the function to 'public'.
          - Recreates the trigger 'on_auth_user_created'.
          - Grants necessary permissions for the function to execute correctly.
          
          ## Security Implications:
          - RLS Status: [Not Affected]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          - This script resolves a security warning by setting a fixed search_path for the function.
          
          ## Performance Impact:
          - Indexes: [Not Affected]
          - Triggers: [Recreated]
          - Estimated Impact: [Negligible. This is a one-time structural change.]
*/

-- Step 1: Drop existing trigger and function to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create the function to handle new user creation.
-- This function inserts a new profile for each new user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Crucial for allowing the function to write to public.profiles
AS $$
BEGIN
  -- Insert a new row into the public.profiles table.
  -- The 'id' is taken from the newly created user in auth.users.
  -- The 'full_name' is extracted from the user's metadata provided during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name'
  );
  RETURN new;
END;
$$;

-- Step 3: Set the search_path for the function.
-- This is the definitive fix for the "Function Search Path Mutable" warning
-- and ensures the function can always find the 'profiles' table in the 'public' schema.
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';

-- Step 4: Create the trigger that fires AFTER a new user is inserted into auth.users.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Grant necessary permissions.
-- Although SECURITY DEFINER is used, explicitly granting usage and execute
-- permissions to key roles is a good practice for robustness.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

-- Step 6: Re-confirm ownership of the function to the 'postgres' role (or the appropriate superuser).
-- This ensures the SECURITY DEFINER context has the necessary privileges to insert into public.profiles.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
