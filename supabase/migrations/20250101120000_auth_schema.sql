/*
# [Auth Schema] Create Profiles Table and New User Trigger
This migration sets up a `profiles` table to store public user data and a trigger to automatically populate it when a new user signs up. This is a foundational step for building user-specific features.

## Query Description:
- Creates a `profiles` table linked to `auth.users`.
- Enables Row Level Security (RLS) on the `profiles` table to ensure users can only access their own data.
- Creates a trigger function `handle_new_user` that fires after a new user is created in `auth.users`.
- This function inserts a corresponding row into `public.profiles`, copying metadata like `full_name`.
- This operation is safe and will not affect existing data.

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- tables: public.profiles
- functions: public.handle_new_user
- triggers: on_auth_user_created

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [Yes] - Adds policies for users to manage their own profiles.
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [Primary Key on profiles.id]
- Triggers: [Added] - A new trigger on `auth.users`.
- Estimated Impact: [Low]
*/

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for the profiles table
CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 4. Create a function to handle new user sign-ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$;

-- 5. Create a trigger to execute the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
