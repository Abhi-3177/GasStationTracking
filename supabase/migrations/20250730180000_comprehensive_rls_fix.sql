/*
  Comprehensive User ID and RLS Fix
  
  This script ensures that all user-related tables have a `user_id` column
  and are protected by Row Level Security (RLS). It is designed to be
  run multiple times without causing errors by using `IF NOT EXISTS` and
  `DROP IF EXISTS` commands.
*/

-- =================================================================
-- Table: accounts
-- =================================================================
-- Step 1: Add user_id column if it doesn't exist.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Enable RLS.
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop old policies to prevent conflicts.
DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts;

-- Step 4: Create a single, comprehensive policy for user ownership.
CREATE POLICY "Users can manage their own accounts"
ON public.accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =================================================================
-- Table: balance_entries
-- =================================================================
ALTER TABLE public.balance_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.balance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own balance entries" ON public.balance_entries;
CREATE POLICY "Users can manage their own balance entries"
ON public.balance_entries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =================================================================
-- Table: day_book_records
-- =================================================================
ALTER TABLE public.day_book_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.day_book_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own day book records" ON public.day_book_records;
CREATE POLICY "Users can manage their own day book records"
ON public.day_book_records FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =================================================================
-- Table: daily_records
-- =================================================================
ALTER TABLE public.daily_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own daily records" ON public.daily_records;
CREATE POLICY "Users can manage their own daily records"
ON public.daily_records FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =================================================================
-- Table: payments_received
-- =================================================================
ALTER TABLE public.payments_received ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own received payments" ON public.payments_received;
CREATE POLICY "Users can manage their own received payments"
ON public.payments_received FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =================================================================
-- Table: profiles (Special Case - RLS based on `id` column)
-- =================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Drop old policies for a clean slate
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
-- Recreate policies
CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles FOR SELECT
USING (true);
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
