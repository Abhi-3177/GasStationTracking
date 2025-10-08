-- Step 1: Drop existing objects to ensure a clean slate.
-- We use "IF EXISTS" to avoid errors if the objects are already gone.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop RLS policies on the profiles table before dropping the table.
-- A better approach is to just disable RLS, drop the table, and let cascade do the work.
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop the profiles table itself. CASCADE will remove dependent objects like policies.
DROP TABLE IF EXISTS public.profiles;


-- Step 2: Recreate the profiles table.
-- This table will store public user data.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  updated_at TIMESTAMPTZ
);
COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';


-- Step 3: Enable Row Level Security (RLS) on the profiles table.
-- This is a crucial security measure.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Step 4: Create RLS policies for the profiles table.
-- 4.1: Users can view their own profile.
CREATE POLICY "Users can view their own profile."
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- 4.2: Users can insert their own profile. (This is for the trigger)
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4.3: Users can update their own profile.
CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- Step 5: Create the function to handle new user creation.
-- This function will be called by the trigger.
-- SECURITY DEFINER is used to give it elevated privileges to write to the profiles table.
-- SET search_path = '' prevents search path hijacking, a security best practice.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name'
  );
  RETURN new;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create a profile for a new user.';


-- Step 6: Create the trigger that calls the function.
-- This trigger fires after a new user is inserted into the auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- Step 7: Grant usage permissions to the relevant roles.
-- This allows 'anon' and 'authenticated' roles to interact with the table
-- as defined by the RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
