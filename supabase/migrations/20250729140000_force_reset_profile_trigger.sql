/*
  # [CRITICAL] Force Reset Profile Creation Trigger
  This migration forcefully resets the automatic user profile creation mechanism.
  It is designed to fix the "Database error creating new user" issue during sign-up
  by ensuring permissions and configurations are correctly set.

  ## Query Description:
  This operation will temporarily disable Row Level Security (RLS) on the `profiles` table,
  recreate the function and trigger responsible for creating profiles, and then re-enable RLS.
  This is a safe operation for existing data but is critical for new user sign-ups to function.
  There is no risk of data loss.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: false (Reverting would require manually dropping the new trigger/function)

  ## Structure Details:
  - Tables affected: `public.profiles` (RLS toggled)
  - Functions affected: `public.handle_new_user` (dropped and recreated)
  - Triggers affected: `on_auth_user_created` on `auth.users` (dropped and recreated)

  ## Security Implications:
  - RLS Status: Temporarily disabled on `public.profiles` during the script execution.
  - Policy Changes: No. RLS is re-enabled with its existing policies.
  - Auth Requirements: Requires admin privileges to run.

  ## Performance Impact:
  - Indexes: None
  - Triggers: Recreated. Negligible impact.
  - Estimated Impact: Low. Affects only new user creation.
*/

-- Step 1: Temporarily disable RLS on the profiles table to ensure the trigger can write.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop the existing trigger and function if they exist, to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Step 3: Create the function that will be called by the trigger.
-- This function inserts a new row into public.profiles.
-- SECURITY DEFINER is used to run the function with the permissions of the function owner (postgres).
-- SET search_path = '' is a security best practice to prevent search path hijacking.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Step 4: Create the trigger that fires after a new user is created in auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Re-enable Row Level Security on the profiles table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
