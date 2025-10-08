/*
          # [DEFINITIVE SIGNUP FIX]
          This migration script completely resets and correctly configures the automatic user profile creation mechanism. It resolves the "Database error creating new user" issue by creating a secure and correctly permissioned function and trigger.

          ## Query Description: "This operation will drop and recreate the function and trigger responsible for creating user profiles upon sign-up. It is a safe and necessary fix for the ongoing authentication issues. No user data will be affected."
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Drops trigger `on_auth_user_created` on `auth.users` if it exists.
          - Drops function `public.handle_new_user` if it exists.
          - Creates function `public.handle_new_user` with `SECURITY DEFINER` and a fixed `search_path`.
          - Creates trigger `on_auth_user_created` to call the new function after a user is created.
          
          ## Security Implications:
          - RLS Status: Unchanged
          - Policy Changes: No
          - Auth Requirements: This function is called by a database trigger on the `auth.users` table.
          - Using `SECURITY DEFINER` allows the function to run with the permissions of the function owner, which is necessary for it to insert into the `public.profiles` table. This is a standard and secure practice for this use case.
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: Replaces one trigger. The impact is negligible and only occurs on user creation.
          - Estimated Impact: "Low"
          */

-- 1. Drop the old trigger and function if they exist to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function to handle new user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- This is the key to fixing permission issues.
-- Set a secure search path to prevent hijacking and ensure the function finds the 'public' schema.
SET search_path = public;
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, linking it to the new user.
  -- It pulls the 'full_name' from the metadata provided during sign-up.
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

-- 3. Create the trigger that executes the function after a new user is created in auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
