/*
# [DEFINITIVE FIX] Reset User Profile Creation Trigger

This script provides a definitive fix for the "Database error creating new user" issue.
It completely resets the mechanism that automatically creates a user profile after sign-up.

## Query Description:
This operation will drop the existing (and potentially broken) user creation trigger and function,
and then recreate them using the latest Supabase security best practices.
This is a safe operation and will not affect any existing user data.
It is designed to fix silent failures during the sign-up process.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by dropping the created trigger/function)

## Structure Details:
- Drops trigger `on_auth_user_created` on table `auth.users`.
- Drops function `public.handle_new_user`.
- Recreates function `public.handle_new_user` with `SECURITY DEFINER` and a fixed `search_path`.
- Recreates trigger `on_auth_user_created` on `auth.users`.

## Security Implications:
- RLS Status: Unchanged.
- Policy Changes: No.
- Auth Requirements: This fixes a core authentication flow issue.
- This script also resolves the "Function Search Path Mutable" security advisory.

## Performance Impact:
- Indexes: None.
- Triggers: Replaces one trigger.
- Estimated Impact: Negligible. The trigger only runs once per user creation.
*/

-- Step 1: Drop the old trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create the function that will be triggered on new user creation.
-- This function is responsible for creating a corresponding row in the public.profiles table.
-- SECURITY DEFINER: This is crucial. It makes the function run with the permissions of the user who created it (the 'postgres' superuser),
-- allowing it to insert into the public.profiles table without permission issues.
-- SET search_path = public: This is also crucial. It fixes the "Function Search Path Mutable" security warning and ensures
-- that the function can always find the 'profiles' table within the 'public' schema.
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new profile row, taking the full_name from the metadata provided during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

-- Step 3: Create the trigger that executes the function.
-- This trigger will fire automatically AFTER a new user is inserted into the auth.users table.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
