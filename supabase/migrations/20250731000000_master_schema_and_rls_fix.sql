DO $$
DECLARE
    table_name TEXT;
BEGIN
    -- This script ensures all data tables have user_id and RLS enabled.
    -- It is idempotent and safe to run multiple times.

    -- List of tables to apply policies to
    FOREACH table_name IN ARRAY ARRAY['accounts', 'day_book_records', 'daily_records', 'payments_received', 'balance_entries']
    LOOP
        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE columns.table_schema = 'public' AND columns.table_name = table_name AND columns.column_name = 'user_id') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE', table_name);
            RAISE NOTICE 'Added user_id to %', table_name;
        END IF;

        -- Add updated_at for tables that need it
        IF table_name IN ('day_book_records', 'daily_records') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE columns.table_schema = 'public' AND columns.table_name = table_name AND columns.column_name = 'updated_at') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()', table_name);
            RAISE NOTICE 'Added updated_at to %', table_name;
        END IF;

        -- Enable RLS on the table
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        RAISE NOTICE 'Enabled RLS for %', table_name;

        -- Drop existing policies to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Users can view their own records." ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own records." ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update their own records." ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own records." ON public.%I', table_name);

        -- Create SELECT policy
        EXECUTE format('CREATE POLICY "Users can view their own records." ON public.%I FOR SELECT USING (auth.uid() = user_id)', table_name);
        
        -- Create INSERT policy
        EXECUTE format('CREATE POLICY "Users can insert their own records." ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', table_name);

        -- Create UPDATE policy
        EXECUTE format('CREATE POLICY "Users can update their own records." ON public.%I FOR UPDATE USING (auth.uid() = user_id)', table_name);

        -- Create DELETE policy
        EXECUTE format('CREATE POLICY "Users can delete their own records." ON public.%I FOR DELETE USING (auth.uid() = user_id)', table_name);

        RAISE NOTICE 'Applied RLS policies for %', table_name;
    END LOOP;

    RAISE NOTICE 'Successfully applied schema and RLS fixes.';
END;
$$;
