/*
# [DEFINITIVE FIX] Reset User Profile Creation Trigger

This script performs a hard reset of the mechanism that automatically creates a user profile when a new user signs up. It is designed to resolve persistent "Database error creating new user" errors by addressing underlying permission issues.

## Query Description:
This operation will:
1. Drop the existing `on_auth_user_created` trigger and `public.handle_new_user` function to ensure a clean slate.
2. Recreate the `public.handle_new_user` function with `SECURITY DEFINER` to ensure it runs with the necessary permissions to insert into `public.profiles`.
3. Sets a fixed `search_path` within the function to prevent schema visibility issues, addressing common security warnings.
4. Recreate the trigger on `auth.users` to call the function after a new user is inserted.

This is a safe structural change and does not affect existing user data.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by dropping the created objects)

## Security Implications:
- RLS Status: Unchanged.
- Policy Changes: No.
- Auth Requirements: Must be run by a user with sufficient privileges (e.g., `postgres` in the Supabase SQL Editor).
*/

-- Step 1: Drop existing objects to ensure a clean state.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create the function to insert a new profile.
-- This function runs with the permissions of the owner (SECURITY DEFINER),
-- which allows it to insert into the public.profiles table.
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

-- Step 3: Create the trigger to call the function on new user creation.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
