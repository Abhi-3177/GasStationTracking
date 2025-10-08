/*
# [DEFINITIVE FIX] Reset User Profile Creation Trigger and RLS

## Query Description:
This script performs a hard reset of the mechanism that automatically creates a user profile upon sign-up. It addresses the "Database error creating new user" and the "Function Search Path Mutable" security warnings.

- It ensures the `profiles` table exists and has the correct Row Level Security (RLS) policies.
- It DROPS the existing trigger and function to ensure a clean state.
- It RECREATES the `handle_new_user` function with `SECURITY DEFINER` and an explicit `search_path`, which is the correct and secure way to configure it.
- It RECREATES the trigger on the `auth.users` table.

This operation is safe to run multiple times.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: false (but recreates functionality)

## Security Implications:
- RLS Status: Enables RLS on `profiles` table.
- Policy Changes: Creates `SELECT`, `INSERT`, and `UPDATE` policies for the `profiles` table.
- Auth Requirements: This function is triggered by the Supabase auth system.
*/

-- 1. Create the profiles table if it doesn't exist
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  full_name text,
  avatar_url text
);

alter table public.profiles enable row level security;

-- 2. Create policies for the profiles table
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );


-- 3. Drop the old trigger and function if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;

-- 4. Create the function to handle new user creation
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

-- 5. Create the trigger to call the function
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Grant usage on the public schema to the necessary roles
grant usage on schema public to postgres, anon, authenticated, service_role;

-- 7. Grant all privileges on the profiles table to the necessary roles
grant all on table public.profiles to postgres, anon, authenticated, service_role;
