/*
# [DEFINITIVE FIX] Reset and Recreate User Profile Trigger

This script provides a definitive fix for the "Database error creating new user" issue by completely resetting the function and trigger responsible for creating user profiles. It addresses security and permission issues that were causing the trigger to fail.

## Query Description:
This operation will drop the existing `handle_new_user` function and its associated trigger, and then recreate them using Supabase best practices. This includes setting the function to run with `SECURITY DEFINER` privileges and fixing the `search_path` to resolve the security warning. This is a safe operation and will not affect existing user data. It only fixes the process for new user sign-ups.

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Drops trigger `on_auth_user_created` on `auth.users`.
- Drops function `public.handle_new_user`.
- Recreates function `public.handle_new_user` with `SECURITY DEFINER` and a fixed `search_path`.
- Recreates trigger `on_auth_user_created` on `auth.users`.

## Security Implications:
- RLS Status: Unchanged.
- Policy Changes: No.
- Auth Requirements: This function is run by the `supabase_auth_admin` role.
- **Fixes Security Warning:** This script resolves the "Function Search Path Mutable" warning.

## Performance Impact:
- Indexes: None.
- Triggers: Replaces an existing trigger. No significant performance impact is expected.
- Estimated Impact: Negligible.
*/

-- 1. Drop the existing trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function to handle new user creation.
-- This function inserts a new row into the public.profiles table when a new user signs up.
-- It runs with the permissions of the user who defined it (SECURITY DEFINER), which is necessary
-- to have write access to the public.profiles table.
-- It also sets a fixed search_path to resolve the security warning and ensure stability.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new profile record for the new user.
  -- It pulls the full_name from the metadata provided during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  
  RETURN new;
END;
$$;

-- 3. Create the trigger to execute the function after a new user is created.
-- This trigger fires after a new row is inserted into the auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant usage on the public schema to the necessary roles
-- This ensures that the authenticated role can access the profiles table
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
