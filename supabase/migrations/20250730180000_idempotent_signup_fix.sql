/*
# [Definitive Idempotent Signup Fix]
This script provides a robust, runnable-multiple-times fix for the user creation process.
It ensures that all components related to creating a user profile are correctly configured.

## Query Description:
This operation will completely reset the functions, triggers, and security policies related to the `profiles` table.
It first drops all potentially conflicting objects and then recreates them according to Supabase best practices.
This is a safe operation as it uses `IF EXISTS` checks and does not delete any user data from `auth.users` or existing `profiles`.

## Metadata:
- Schema-Category: ["Structural", "Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: false (but re-runnable)

## Structure Details:
- Tables affected: public.profiles
- Functions affected: public.handle_new_user
- Triggers affected: on_auth_user_created on auth.users
- Policies affected: All policies on public.profiles

## Security Implications:
- RLS Status: Enabled on public.profiles
- Policy Changes: Yes (recreates policies for select, insert, update)
- Auth Requirements: Admin privileges to run.

## Performance Impact:
- Indexes: None
- Triggers: Recreates one trigger.
- Estimated Impact: Negligible.
*/

-- Step 1: Drop existing policies on the profiles table to prevent conflicts.
-- The `IF EXISTS` clause makes this command safe to run even if the policies don't exist.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
-- Also dropping the policy from the specific error message to be safe.
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;


-- Step 2: Drop the existing trigger from the `auth.users` table if it exists.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- Step 3: Drop the existing function if it exists.
DROP FUNCTION IF EXISTS public.handle_new_user();


-- Step 4: Recreate the function to handle new user creation.
-- This function is called by the trigger and creates a profile entry.
-- `SECURITY DEFINER` allows it to run with the permissions of the function owner.
-- `SET search_path` ensures it can find the `public` schema, resolving security warnings.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into the public.profiles table, taking the full_name from the user's metadata.
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;


-- Step 5: Recreate the trigger on the `auth.users` table.
-- This trigger will call the `handle_new_user` function every time a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Step 6: Ensure the `profiles` table has RLS enabled.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Step 7: Recreate the security policies for the `profiles` table.
-- These policies define who can see, create, and update profiles.
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 8: Grant permissions to the function again to be safe.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;
