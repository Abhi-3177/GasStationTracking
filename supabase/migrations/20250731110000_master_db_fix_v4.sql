-- This script is idempotent and can be run multiple times safely.
-- It fixes previous errors by using a non-ambiguous variable name (tbl_name)
-- and by being wrapped in a DO block for procedural execution.
DO $$
DECLARE
    tbl_name TEXT;
BEGIN
    -- Loop through all user-related tables
    FOREACH tbl_name IN ARRAY ARRAY['accounts', 'day_book_records', 'daily_records', 'payments_received', 'balance_entries']
    LOOP
        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'user_id'
        ) THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(tbl_name) || ' ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;';
            RAISE NOTICE 'Added user_id to %', tbl_name;
        END IF;

        -- Add updated_at column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'updated_at'
        ) THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(tbl_name) || ' ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();';
            RAISE NOTICE 'Added updated_at to %', tbl_name;
        END IF;

        -- Enable RLS
        EXECUTE 'ALTER TABLE public.' || quote_ident(tbl_name) || ' ENABLE ROW LEVEL SECURITY;';
        RAISE NOTICE 'Enabled RLS on %', tbl_name;

        -- Drop existing policies to prevent errors
        EXECUTE 'DROP POLICY IF EXISTS "Enable all access for users based on user_id" ON public.' || quote_ident(tbl_name) || ';';
        EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON public.' || quote_ident(tbl_name) || ';';
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own records" ON public.' || quote_ident(tbl_name) || ';';

        -- Create a new, comprehensive policy
        EXECUTE 'CREATE POLICY "Users can manage their own records" ON public.' || quote_ident(tbl_name) || 
                ' FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);';
        RAISE NOTICE 'Applied RLS policy to %', tbl_name;
    END LOOP;

    -- Special handling for profiles table
    -- Drop old policies
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
    
    -- Create new policies for profiles
    CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
      FOR SELECT USING (true);

    CREATE POLICY "Users can insert their own profile." ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);

    CREATE POLICY "Users can update their own profile." ON public.profiles
      FOR UPDATE USING (auth.uid() = id);

    RAISE NOTICE 'Successfully applied schema and RLS fixes.';
END;
$$;
