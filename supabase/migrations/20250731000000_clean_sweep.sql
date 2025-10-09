-- WARNING: THIS IS A DESTRUCTIVE AND IRREVERSIBLE ACTION.
-- This script will permanently delete all application data and reset the schema.

-- Step 1: Drop all application tables. The CASCADE option will handle dependencies.
DROP TABLE IF EXISTS public.balance_entries CASCADE;
DROP TABLE IF EXISTS public.payments_received CASCADE;
DROP TABLE IF EXISTS public.daily_records CASCADE;
DROP TABLE IF EXISTS public.day_book_records CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- Step 2: Recreate the 'accounts' table
CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text DEFAULT 'factory'::text NOT NULL,
    contact text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Enable RLS and set policies
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own accounts." ON public.accounts;
CREATE POLICY "Users can manage their own accounts." ON public.accounts FOR ALL USING (auth.uid() = user_id);

-- Step 3: Recreate the 'balance_entries' table
CREATE TABLE public.balance_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    description text NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Enable RLS and set policies
ALTER TABLE public.balance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage balance entries for their accounts." ON public.balance_entries;
CREATE POLICY "Users can manage balance entries for their accounts." ON public.balance_entries FOR ALL USING (auth.uid() = user_id);

-- Step 4: Recreate the 'day_book_records' table
CREATE TABLE public.day_book_records (
    date date NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    record jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (date, user_id)
);
-- Enable RLS and set policies
ALTER TABLE public.day_book_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own day book records." ON public.day_book_records;
CREATE POLICY "Users can manage their own day book records." ON public.day_book_records FOR ALL USING (auth.uid() = user_id);

-- Step 5: Recreate the 'daily_records' table
CREATE TABLE public.daily_records (
    date date NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_reconciliation jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (date, user_id)
);
-- Enable RLS and set policies
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own daily records." ON public.daily_records;
CREATE POLICY "Users can manage their own daily records." ON public.daily_records FOR ALL USING (auth.uid() = user_id);

-- Step 6: Recreate the 'payments_received' table
CREATE TABLE public.payments_received (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    date date NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Enable RLS and set policies
ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own received payments." ON public.payments_received;
CREATE POLICY "Users can manage their own received payments." ON public.payments_received FOR ALL USING (auth.uid() = user_id);

-- Step 7: Ensure the profiles table and its trigger are correct
-- Drop existing policies first to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
-- Recreate policies
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Drop old trigger and function if they exist to ensure a clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_public_profile_for_new_user;
-- Recreate function
CREATE OR REPLACE FUNCTION public.create_public_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_public_profile_for_new_user();
