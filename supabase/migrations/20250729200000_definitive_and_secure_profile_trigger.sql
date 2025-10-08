/*
# [Definitive Profile Creation Trigger Fix]
This script completely resets the automatic user profile creation mechanism. It drops the old trigger and function, then recreates them using Supabase best practices, including `SECURITY DEFINER` and a fixed `search_path`. This ensures the function has the necessary permissions to create a profile entry after a new user signs up and resolves the "Function Search Path Mutable" security warning.

## Query Description: [This operation will replace the existing (and failing) user profile creation logic with a secure and reliable version. It is a safe, standard procedure for Supabase projects and has no impact on existing user data. No backup is required.]

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Drops trigger `on_auth_user_created` on `auth.users`.
- Drops function `public.handle_new_user()`.
- Recreates function `public.handle_new_user()` with `SECURITY DEFINER` and a set `search_path`.
- Recreates trigger `on_auth_user_created` to call the new function.

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: This fix is essential for the authentication flow to work correctly. It improves security by resolving the `search_path` warning.

## Performance Impact:
- Indexes: None
- Triggers: Replaces one trigger.
- Estimated Impact: Negligible. This is a standard and lightweight trigger.
*/

-- Step 1: Drop the old trigger and function if they exist to ensure a clean slate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Step 2: Create the function to handle new user creation.
-- This function runs with the permissions of the user who defined it (the owner),
-- which allows it to insert into the public.profiles table.
-- It also sets a fixed search_path to resolve the security warning.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

-- Step 3: Create the trigger that calls the function after a new user is created.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
