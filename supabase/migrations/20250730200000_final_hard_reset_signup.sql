/*
  # [DEFINITIVE HARD RESET] User Profile Creation

  [This script performs a complete and total reset of the user profile creation system. It is designed to be run on a database that may be in an inconsistent state from previous, partially failed migrations. It will safely drop all related tables, functions, triggers, and policies before recreating them from scratch according to Supabase best practices.]

  ## Query Description: [This is a destructive operation. It will permanently delete the `profiles` table and all associated data. This is necessary to resolve persistent configuration errors and ensure the sign-up process works correctly. No other data will be affected.]
  
  ## Metadata:
  - Schema-Category: ["Dangerous", "Structural"]
  - Impact-Level: ["High"]
  - Requires-Backup: [true]
  - Reversible: [false]
  
  ## Structure Details:
  - Drops and recreates the `public.profiles` table.
  - Drops and recreates the `handle_new_user` function.
  - Drops and recreates the `on_auth_user_created` trigger.
  - Drops and recreates all RLS policies on the `profiles` table.
  
  ## Security Implications:
  - RLS Status: [Re-enabled]
  - Policy Changes: [Yes, policies are reset to a secure default.]
  - Auth Requirements: [None for this script.]
  
  ## Performance Impact:
  - Indexes: [Primary key index on `profiles` is recreated.]
  - Triggers: [The `on_auth_user_created` trigger is recreated.]
  - Estimated Impact: [Low. This is a one-time setup operation.]
*/

-- Step 1: Drop existing objects if they exist to prevent conflicts.
-- The order is important: drop trigger, then function, then table policies, then table.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;
DROP FUNCTION IF EXISTS public.create_public_profile_for_new_user; -- Clean up old named function

-- It's safer to disable RLS before dropping policies
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

DROP TABLE IF EXISTS public.profiles;


-- Step 2: Recreate the profiles table.
-- This is the simplest possible profile table to ensure it works.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT
);

COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';


-- Step 3: Re-enable Row Level Security (RLS) on the profiles table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Step 4: Create the security policies for the profiles table.
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

  
-- Step 5: Create the function that will be called by the trigger.
-- This function inserts a new row into public.profiles for a new user.
-- It sets a fixed search_path to resolve the security warnings.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates a profile for a new user.';


-- Step 6: Create the trigger on the auth.users table.
-- This trigger calls the handle_new_user function after a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
