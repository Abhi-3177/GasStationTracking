-- =================================================================
-- Master Schema and RLS Fix
-- 
-- This script is designed to be run to fix any inconsistencies in 
-- your database schema and Row Level Security (RLS) policies.
-- It is idempotent, meaning it is safe to run multiple times.
-- 
-- What it does:
-- 1. Creates a function to automatically update `updated_at` columns.
-- 2. Iterates through all relevant tables:
--    - Adds `user_id` and `updated_at` columns if they don't exist.
--    - Applies the `updated_at` trigger.
--    - Enables RLS.
--    - Drops any old, conflicting policies.
--    - Creates a single, correct "manage own records" policy.
-- =================================================================

-- 1. Create the function to handle `updated_at` timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Define an array of tables to process
DO $$
DECLARE
    tables_to_process TEXT[] := ARRAY['day_book_records', 'daily_records', 'accounts', 'balance_entries', 'payments_received'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables_to_process
    LOOP
        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = table_name AND column_name = 'user_id') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE', table_name);
        END IF;

        -- Add updated_at column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = table_name AND column_name = 'updated_at') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()', table_name);
        END IF;

        -- Drop existing trigger if it exists, then create it
        EXECUTE format('DROP TRIGGER IF EXISTS on_update_set_timestamp ON public.%I;', table_name);
        EXECUTE format('CREATE TRIGGER on_update_set_timestamp BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();', table_name);

        -- Enable Row Level Security
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);

        -- Drop old policies to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Users can view their own records." ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own records." ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update their own records." ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own records." ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for users based on user_id" ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own records." ON public.%I;', table_name);

        -- Create the single, correct policy for all actions
        EXECUTE format('CREATE POLICY "Users can manage their own records." ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', table_name);
    END LOOP;
END;
$$;

-- 3. Special handling for the `profiles` table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Recreate the profile creation trigger to ensure it's correct
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- That's it! Your schema and RLS policies should now be correct.
