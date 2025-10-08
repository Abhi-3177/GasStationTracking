-- 1. Drop existing trigger and function if they exist, ensuring a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

/*
  # [Function] handle_new_user
  [This function creates a new user profile in the public.profiles table whenever a new user is created in the auth.users table.]

  ## Query Description: [This operation resets the automatic user profile creation mechanism. It is designed to fix sign-up errors caused by permission issues. It first removes the old function and trigger, then recreates them with the correct security settings. This is a safe operation and does not affect existing user data.]
  
  ## Metadata:
  - Schema-Category: ["Structural"]
  - Impact-Level: ["Low"]
  - Requires-Backup: [false]
  - Reversible: [true]
  
  ## Structure Details:
  - Function: `public.handle_new_user()`
  - Trigger: `on_auth_user_created` on `auth.users`
  
  ## Security Implications:
  - RLS Status: [Not directly affected, but enables profile creation which is subject to RLS]
  - Policy Changes: [No]
  - Auth Requirements: [This function runs with the permissions of the definer (`SECURITY DEFINER`), which is necessary for it to insert into the `public.profiles` table.]
  
  ## Performance Impact:
  - Indexes: [None]
  - Triggers: [Adds a trigger to `auth.users` table, which has a negligible impact on user creation performance.]
  - Estimated Impact: [Low]
*/
-- 2. Create the function with SECURITY DEFINER and a fixed search_path.
-- This is the crucial step to fix permission issues and the search_path warning.
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

/*
  # [Trigger] on_auth_user_created
  [This trigger executes the handle_new_user function after a new user is inserted into the auth.users table.]

  ## Query Description: [This operation attaches the profile creation logic to the user sign-up process. It is a safe and necessary step for automatic profile management.]
  
  ## Metadata:
  - Schema-Category: ["Structural"]
  - Impact-Level: ["Low"]
  - Requires-Backup: [false]
  - Reversible: [true]
  
  ## Structure Details:
  - Trigger: `on_auth_user_created` on `auth.users`
  
  ## Security Implications:
  - RLS Status: [Not affected]
  - Policy Changes: [No]
  - Auth Requirements: [None]
  
  ## Performance Impact:
  - Indexes: [None]
  - Triggers: [Adds a trigger to `auth.users` table.]
  - Estimated Impact: [Low]
*/
-- 3. Recreate the trigger to call the new function.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
