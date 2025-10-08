/*
# [ULTIMATE FIX] Reset Profile Creation Trigger
This script provides a definitive fix for the "Database error creating new user" issue by completely resetting the user profile creation mechanism. It addresses permissions and search path issues that cause the trigger to fail.

## Query Description:
This operation will drop the existing `handle_new_user` function and its associated trigger, then recreate them using Supabase best practices. This ensures that when a new user signs up, their profile is correctly created in the `public.profiles` table. This operation is safe and will not affect existing user data.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by dropping the new trigger/function)

## Structure Details:
- Drops function: `public.handle_new_user`
- Drops trigger: `on_auth_user_created` on `auth.users`
- Creates function: `public.handle_new_user`
- Creates trigger: `on_auth_user_created` on `auth.users`

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: This script fixes a core authentication-related function.
- The new function uses `SECURITY DEFINER` to run with elevated privileges, which is the standard and required practice for this type of trigger. It also sets a fixed `search_path` to resolve the security warning.

## Performance Impact:
- Indexes: None
- Triggers: Replaces one trigger. Negligible impact.
- Estimated Impact: No noticeable performance impact.
*/

-- 1. Drop the old trigger and function if they exist, ensuring a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- 2. Create the function to handle new user creation.
-- This function runs with the security of the definer (the admin role that creates it),
-- which is necessary to insert into the public.profiles table.
-- It also sets a specific search_path to resolve the security warning and ensure stability.
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

-- 3. Create the trigger to call the function after a new user is created in auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
