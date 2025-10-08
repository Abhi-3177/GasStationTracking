/*
# [Fix] Recreate Profile Trigger and Policies
This migration script completely resets the automatic profile creation mechanism. It addresses the "Database error creating new user" by dropping the old components and creating fresh, standard ones based on Supabase's official recommendations.

## Query Description: [This operation is a safe reset for the user sign-up functionality. It will not affect any existing user data or other parts of the database. It drops and recreates a function, a trigger, and the security policies on the `profiles` table to ensure they are correctly configured.]

## Metadata:
- Schema-Category: ["Structural", "Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- Drops and recreates function: `public.handle_new_user()`
- Drops and recreates trigger: `on_auth_user_created` on `auth.users`
- Drops and recreates all policies on table: `public.profiles`

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [Yes, policies are reset to a secure standard.]
- Auth Requirements: [The new function is `SECURITY DEFINER`, which is necessary for it to work correctly with Supabase Auth.]

## Performance Impact:
- Indexes: [None]
- Triggers: [Modified]
- Estimated Impact: [Negligible. This only affects the one-time action of user sign-up.]
*/

-- Step 1: Drop existing components to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create the function that inserts a new profile row.
-- This is the standard function recommended by Supabase. It runs with the permissions
-- of the function owner (`postgres`), which bypasses RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

-- Step 3: Create the trigger that calls the function on new user creation.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 4: Reset and create standard RLS policies for the `profiles` table.
-- Drop all existing policies on `profiles` to avoid conflicts.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY ' || quote_ident(r.policyname) || ' ON public.profiles;';
    END LOOP;
END $$;

-- Re-enable RLS on the table just in case it was disabled.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create the standard, secure policies.
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
