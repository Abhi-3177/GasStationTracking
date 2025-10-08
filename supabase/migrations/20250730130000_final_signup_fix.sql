-- This script sets up the trigger to create a user profile in `public.profiles`
-- after a new user signs up in `auth.users`. It is the correct and secure way.

-- 1. Drop existing trigger and function for a clean slate.
-- It's safe to run these even if they don't exist.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the function to handle new user creation.
-- This function will insert a new row into public.profiles.
-- SECURITY DEFINER is used to grant the function the necessary permissions.
-- SET search_path ensures the function runs in a secure and predictable environment.
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

-- 3. Create the trigger to call the function after a new user is created.
-- This is the standard way to attach logic to the auth.users table without altering it.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Ensure RLS is enabled and policies are in place for the profiles table.
-- This is a security best practice.

-- Enable Row Level Security on the profiles table if not already enabled.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent errors on re-run
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

-- Create policies for profile access
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );
