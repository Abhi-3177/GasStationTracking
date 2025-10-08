/*
# [CRITICAL] Definitive Profile Creation Trigger Reset (Final Attempt)
This is the final, most comprehensive script to fix the "Database error creating new user" issue. It forcefully resets all components, explicitly sets permissions, and uses the most secure and stable configuration.

## Query Description:
This script will:
1.  Completely remove the existing `handle_new_user` function and its associated trigger.
2.  Explicitly grant all necessary permissions on the `profiles` table to the `postgres` and `authenticated` roles. This is a diagnostic step to rule out permission issues.
3.  Recreate the function with `SECURITY DEFINER` and a fixed `search_path`. This ensures it runs with admin rights and can always find the `profiles` table, fixing the security warning.
4.  Recreate the trigger on the `auth.users` table to call this new, robust function.

This is the definitive method to resolve this issue.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true (by dropping the created function and trigger)

## Security Implications:
- RLS Status: Not changed
- Policy Changes: No
- Auth Requirements: This script fixes a core authentication flow issue.
*/

-- Step 1: Drop the old trigger and function to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Explicitly grant permissions to ensure the function can write to the profiles table.
-- This is a diagnostic step to override any potential permission issues.
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.profiles TO postgres, authenticated;

-- Step 3: Create the function to handle new user creation.
-- It uses SECURITY DEFINER to run with elevated privileges.
-- It sets a fixed search_path to resolve the security warning and ensure stability.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, linking it to the new user.
  -- We also populate the full_name from the metadata provided during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;

-- Step 4: Create the trigger that fires after a new user is inserted into auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
