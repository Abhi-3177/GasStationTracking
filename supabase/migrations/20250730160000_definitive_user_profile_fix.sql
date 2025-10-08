-- Drop existing trigger and function to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

/*
# [Function] handle_new_user
Creates a profile for a new user in the public.profiles table.

## Query Description:
This function is designed to run automatically after a new user signs up. It takes the user's ID and full name from the authentication service and inserts it into your public `profiles` table. This is a safe, standard procedure for managing user profiles.

## Metadata:
- Schema-Category: ["Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (by dropping the function)

## Structure Details:
- Function: `public.handle_new_user()`
- Tables Affected: `public.profiles` (INSERT)

## Security Implications:
- RLS Status: This function runs with the permissions of the user who defined it (`SECURITY DEFINER`), allowing it to create a profile entry even if the new user doesn't have insert permissions yet. This is a secure and standard pattern.
- Policy Changes: No
- Auth Requirements: This function is triggered by the Supabase authentication system.

## Performance Impact:
- Indexes: None
- Triggers: One new trigger is created on the `auth.users` table.
- Estimated Impact: Negligible. This is a very fast operation that runs once per user sign-up.
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the permissions of the function owner, which is necessary to insert into public.profiles.
SET search_path = public -- Ensures the function can find the 'public' schema, fixing security warnings.
AS $$
BEGIN
  -- Inserts a new row into the public.profiles table, linking it to the new user.
  -- It pulls the 'full_name' from the metadata provided during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;

-- Create the trigger on the auth.users table.
-- This trigger will execute the handle_new_user function every time a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comments for clarity
COMMENT ON FUNCTION public.handle_new_user IS 'Creates a public profile for a new user upon sign-up.';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Fires after a new user is created to automatically generate their profile.';
