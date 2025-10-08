/*
# [Definitive Profile Creation Trigger Reset]
This script completely resets the automatic user profile creation mechanism. It drops the existing trigger and function, then recreates them with the correct permissions and a stable execution environment. This is designed to fix persistent "Database error creating new user" errors during sign-up.

## Query Description:
This operation will drop and recreate the `handle_new_user` function and the `on_auth_user_created` trigger. It is a safe operation that only affects the backend mechanism for new user creation and has no impact on existing user data or profiles. It also resolves a known security warning by setting a fixed `search_path`.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Drops trigger `on_auth_user_created` on table `auth.users`.
- Drops function `public.handle_new_user`.
- Recreates function `public.handle_new_user` with `SECURITY DEFINER` and a fixed `search_path`.
- Recreates trigger `on_auth_user_created` to call the new function.

## Security Implications:
- RLS Status: Not directly affected, but this enables profile creation which is governed by RLS.
- Policy Changes: No
- Auth Requirements: This function is critical for the `auth.users` table to function correctly with the public `profiles` table. It also fixes the 'Function Search Path Mutable' security warning.

## Performance Impact:
- Indexes: None
- Triggers: Replaces 1 trigger on `auth.users`.
- Estimated Impact: Negligible. This operation is lightweight and only affects new user sign-ups.
*/

-- 1. Drop the existing trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function to handle new user creation.
-- This version includes `SECURITY DEFINER` to run with the permissions of the owner,
-- and `SET search_path = public` to fix the security warning and ensure the `profiles` table is found.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 3. Create the trigger to call the function after a new user is created in `auth.users`.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant usage to the public schema for the postgres role
GRANT USAGE ON SCHEMA public TO postgres;

-- 5. Grant execute permissions on the function to the necessary roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
