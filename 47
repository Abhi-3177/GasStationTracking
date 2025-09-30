/*
  # Initial Schema Setup
  This script sets up the initial database schema for the Gas Station Tracking application.
  It creates the necessary tables to store accounts, day book records, and daily reconciliation data.

  ## Query Description: This is a safe, structural migration. It creates new tables and does not affect any existing data, as it's intended for initial setup.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: false

  ## Structure Details:
  - Creates table: `accounts`
  - Creates table: `balance_entries`
  - Creates table: `day_book_records`
  - Creates table: `daily_records`

  ## Security Implications:
  - RLS Status: RLS is enabled by default on new tables. Policies will need to be added to allow access.
  - Policy Changes: No
  - Auth Requirements: None for schema creation. Policies will use `auth.uid()`.
*/

-- Create the accounts table
CREATE TABLE public.accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL DEFAULT 'factory'::text,
    contact text NULL,
    address text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Create the balance_entries table
CREATE TABLE public.balance_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    date timestamptz NOT NULL,
    description text NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT balance_entries_pkey PRIMARY KEY (id),
    CONSTRAINT balance_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE
);
ALTER TABLE public.balance_entries ENABLE ROW LEVEL SECURITY;

-- Create the day_book_records table
CREATE TABLE public.day_book_records (
    date date NOT NULL,
    record jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT day_book_records_pkey PRIMARY KEY (date)
);
ALTER TABLE public.day_book_records ENABLE ROW LEVEL SECURITY;

-- Create the daily_records table
CREATE TABLE public.daily_records (
    date date NOT NULL,
    record jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_records_pkey PRIMARY KEY (date)
);
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- Add RLS policies to allow authenticated users to access their data.
CREATE POLICY "Allow all access to authenticated users on accounts"
ON public.accounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to authenticated users on balance_entries"
ON public.balance_entries
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to authenticated users on day_book_records"
ON public.day_book_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to authenticated users on daily_records"
ON public.daily_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
