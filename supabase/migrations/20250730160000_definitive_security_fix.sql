/*
          # [DEFINITIVE SECURITY FIX]
          This script completely resets the user profile creation trigger to resolve the "Function Search Path Mutable" security advisory and ensure stable user sign-ups.

          ## Query Description: [This operation will drop and recreate the function and trigger responsible for creating user profiles. It is a safe, non-destructive operation for existing user data but is critical for fixing the security warning and ensuring new user sign-ups work reliably.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Drops the existing `on_auth_user_created` trigger on `auth.users`.
          - Drops the existing `public.handle_new_user` function.
          - Recreates the `public.handle_new_user` function with `SECURITY DEFINER` and a fixed `search_path` to resolve the security warning.
          - Recreates the trigger to call the new, secure function.
          
          ## Security Implications:
          - RLS Status: [No Change]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [No Change]
          - Triggers: [Modified]
          - Estimated Impact: [Negligible. Improves reliability of the sign-up process.]
          */

-- Drop the existing trigger and function to ensure a clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with the correct security settings and search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public' -- This line fixes the security warning
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

-- Recreate the trigger to call the new function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add a comment to the function for clarity
COMMENT ON FUNCTION public.handle_new_user() IS 'Securely creates a user profile upon new user signup.';
