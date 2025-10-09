DO $$
DECLARE
    tbl_name TEXT;
BEGIN
    -- Loop through all tables that use user_id for RLS
    FOREACH tbl_name IN ARRAY ARRAY['day_book_records', 'accounts', 'balance_entries', 'daily_records', 'payments_received']
    LOOP
        RAISE NOTICE 'Processing table: %', tbl_name;

        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = tbl_name AND c.column_name = 'user_id') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;', tbl_name);
            RAISE NOTICE 'Added user_id to %', tbl_name;
        ELSE
            RAISE NOTICE 'user_id column already exists on %', tbl_name;
        END IF;

        -- Add updated_at column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = tbl_name AND c.column_name = 'updated_at') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();', tbl_name);
            RAISE NOTICE 'Added updated_at to %', tbl_name;
        ELSE
            RAISE NOTICE 'updated_at column already exists on %', tbl_name;
        END IF;

        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);
        RAISE NOTICE 'Enabled RLS on %', tbl_name;

        -- Drop existing policies to prevent errors
        EXECUTE format('DROP POLICY IF EXISTS "User can view their own records" ON public.%I;', tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS "User can insert their own records" ON public.%I;', tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS "User can update their own records" ON public.%I;', tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS "User can delete their own records" ON public.%I;', tbl_name);
        RAISE NOTICE 'Dropped existing policies on %', tbl_name;

        -- Create new policies
        EXECUTE format('CREATE POLICY "User can view their own records" ON public.%I FOR SELECT USING (auth.uid() = user_id);', tbl_name);
        EXECUTE format('CREATE POLICY "User can insert their own records" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id);', tbl_name);
        EXECUTE format('CREATE POLICY "User can update their own records" ON public.%I FOR UPDATE USING (auth.uid() = user_id);', tbl_name);
        EXECUTE format('CREATE POLICY "User can delete their own records" ON public.%I FOR DELETE USING (auth.uid() = user_id);', tbl_name);
        RAISE NOTICE 'Applied RLS policies to %', tbl_name;
    END LOOP;

    -- Special handling for 'profiles' table which links directly to auth.users.id
    RAISE NOTICE 'Processing table: profiles';
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on profiles';

    -- Drop existing policies for profiles to prevent errors
    DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Users can delete their own profile." ON public.profiles;
    RAISE NOTICE 'Dropped existing policies on profiles';

    -- Create new policies for profiles
    CREATE POLICY "Users can view their own profile." ON public.profiles
      FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can insert their own profile." ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY "Users can update their own profile." ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can delete their own profile." ON public.profiles
      FOR DELETE USING (auth.uid() = id);
    RAISE NOTICE 'Applied RLS policies to profiles';

    RAISE NOTICE 'Successfully applied schema and RLS fixes.';
END $$;
