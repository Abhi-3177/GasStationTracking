/*
  # [Fix] New User Profile Creation Trigger
  This script fixes the "Database error creating new user" issue during sign-up. It replaces the existing mechanism for creating a user profile with a robust and secure function and trigger.

  ## Query Description:
  - **`handle_new_user` function:** This function is automatically triggered when a new user signs up. It takes the user's ID and the `full_name` provided during sign-up and inserts a corresponding entry into the `public.profiles` table.
  - **`on_auth_user_created` trigger:** This trigger ensures the `handle_new_user` function is executed immediately after a new user is added to the `auth.users` table.
  - **`SECURITY DEFINER`:** This is a crucial setting that allows the function to run with elevated permissions, ensuring it can create the profile row without being blocked by restrictive Row Level Security (RLS) policies. This is a safe and standard Supabase practice for this scenario.

  This operation is safe and will not affect existing users or data. It only affects the creation of new users.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Creates/Replaces function: `public.handle_new_user()`
  - Creates/Replaces trigger: `on_auth_user_created` on `auth.users` table

  ## Security Implications:
  - RLS Status: Unchanged on `public.profiles`. The `SECURITY DEFINER` function safely bypasses RLS for the specific task of profile creation.
  - Policy Changes: No
  - Auth Requirements: This function is tied to the `auth.users` table.
*/

-- Creates a function to automatically insert a new row into public.profiles
-- when a new user signs up. This handles the full_name provided on the client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- Creates a trigger that fires the handle_new_user function
-- after a new user is inserted into the auth.users table.
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
