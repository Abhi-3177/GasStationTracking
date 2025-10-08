/*
# [Operation Name]
Definitive User Profile Creation Fix

## Query Description:
This script provides a final, robust fix for the user sign-up issue. It completely resets the mechanism that automatically creates a user profile after they sign up.

This operation will:
1.  Drop the old, potentially misconfigured trigger and function.
2.  Recreate the function with `SECURITY DEFINER` to ensure it runs with the necessary permissions to insert into the `profiles` table.
3.  Explicitly set the `search_path` within the function to resolve security warnings and prevent schema-related errors.
4.  Recreate the trigger to correctly link new users in `auth.users` to their corresponding entry in `public.profiles`.

This is a safe, structural change and does not affect existing user data.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Function `handle_new_user` will be dropped and recreated.
- Trigger `on_auth_user_created` on `auth.users` will be dropped and recreated.

## Security Implications:
- RLS Status: Unchanged.
- Policy Changes: No.
- Auth Requirements: This script fixes an issue with the authentication flow.
- Using `SECURITY DEFINER` is a standard and secure practice for this specific trigger pattern in Supabase.

## Performance Impact:
- Indexes: None.
- Triggers: Replaces an existing trigger. Negligible impact on `INSERT` performance for new users.
- Estimated Impact: Low.
*/

-- Step 1: Drop the old trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Step 2: Create the function to handle new user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- This is crucial for permissions
-- Set a stable search path to prevent schema-related errors and fix security warnings.
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, using the ID and metadata from the new auth.users record.
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

-- Step 3: Create the trigger that fires after a new user is inserted into auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
