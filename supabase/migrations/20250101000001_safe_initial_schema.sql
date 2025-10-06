/*
          # [Safe Initial Schema Creation]
          This script creates the initial database schema for the Gas Station Tracking application.
          It includes tables for accounts, balance entries, day book records, and daily reconciliation records.
          This version uses `IF NOT EXISTS` to prevent errors if the script is run multiple times.

          ## Query Description: [This script is safe to run on an existing database that may have been partially set up. It will only create tables and indexes that are missing. It will not alter or delete any existing data. No backup is required for this operation.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Tables Created: `accounts`, `balance_entries`, `day_book_records`, `daily_records`
          - Indexes Created: Indexes on primary keys and foreign keys for performance.
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [Yes]
          - Auth Requirements: [authenticated]
          
          ## Performance Impact:
          - Indexes: [Added]
          - Triggers: [Added]
          - Estimated Impact: [Low. Adds necessary tables and indexes for application functionality.]
          */

-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'factory',
  contact TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.accounts IS 'Stores information about factory and transporter accounts.';

-- Create balance_entries table
CREATE TABLE IF NOT EXISTS public.balance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL, -- 'credit' or 'debit'
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.balance_entries IS 'Stores opening balance adjustments for accounts.';

-- Create day_book_records table
CREATE TABLE IF NOT EXISTS public.day_book_records (
  date DATE PRIMARY KEY,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.day_book_records IS 'Stores the daily sales and machine readings from the Day Book.';

-- Create daily_records table
CREATE TABLE IF NOT EXISTS public.daily_records (
  date DATE PRIMARY KEY,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.daily_records IS 'Stores the daily reconciliation data.';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_name ON public.accounts(name);
CREATE INDEX IF NOT EXISTS idx_balance_entries_account_id ON public.balance_entries(account_id);

-- Add Foreign Key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'balance_entries_account_id_fkey' AND conrelid = 'public.balance_entries'::regclass
  ) THEN
    ALTER TABLE public.balance_entries 
    ADD CONSTRAINT balance_entries_account_id_fkey 
    FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE CASCADE;
  END IF;
END;
$$;

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for 'updated_at'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_day_book_update_set_timestamp') THEN
    CREATE TRIGGER on_day_book_update_set_timestamp
    BEFORE UPDATE ON public.day_book_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_daily_record_update_set_timestamp') THEN
    CREATE TRIGGER on_daily_record_update_set_timestamp
    BEFORE UPDATE ON public.daily_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_book_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all access to authenticated users' AND polrelid = 'public.accounts'::regclass) THEN
    CREATE POLICY "Allow all access to authenticated users" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all access to authenticated users' AND polrelid = 'public.balance_entries'::regclass) THEN
    CREATE POLICY "Allow all access to authenticated users" ON public.balance_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all access to authenticated users' AND polrelid = 'public.day_book_records'::regclass) THEN
    CREATE POLICY "Allow all access to authenticated users" ON public.day_book_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all access to authenticated users' AND polrelid = 'public.daily_records'::regclass) THEN
    CREATE POLICY "Allow all access to authenticated users" ON public.daily_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
