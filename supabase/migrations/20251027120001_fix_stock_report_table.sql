/*
  # [SAFE] Create stock_reports Table
  [This script creates the `stock_reports` table if it does not already exist. It is designed to be safe to run multiple times.]

  ## Query Description: [This operation adds a new table to store historical stock report data. It is non-destructive and will not affect existing data.]
  
  ## Metadata:
  - Schema-Category: ["Structural"]
  - Impact-Level: ["Low"]
  - Requires-Backup: [false]
  - Reversible: [true] (Dropping the table would reverse this)
  
  ## Structure Details:
  - Table: public.stock_reports
  - Columns: [id, user_id, start_date, end_date, opening_stock_petrol, opening_stock_diesel, closing_stock_petrol, closing_stock_diesel, opening_readings_petrol, opening_readings_diesel, closing_readings_petrol, closing_readings_diesel, report_data, created_at]
  
  ## Security Implications:
  - RLS Status: [Enabled]
  - Policy Changes: [Yes]
  - Auth Requirements: [User must be authenticated]
  
  ## Performance Impact:
  - Indexes: [Primary key index on `id`]
  - Triggers: [None]
  - Estimated Impact: [Low. This is a new table with no initial data.]
*/
CREATE TABLE IF NOT EXISTS public.stock_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    opening_stock_petrol real NOT NULL,
    opening_stock_diesel real NOT NULL,
    closing_stock_petrol real NOT NULL,
    closing_stock_diesel real NOT NULL,
    opening_readings_petrol real[] NOT NULL,
    opening_readings_diesel real[] NOT NULL,
    closing_readings_petrol real[] NOT NULL,
    closing_readings_diesel real[] NOT NULL,
    report_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security on the new table
ALTER TABLE public.stock_reports ENABLE ROW LEVEL SECURITY;

-- Drop the policy if it exists to ensure it can be re-created without error
DROP POLICY IF EXISTS "Users can manage their own stock reports" ON public.stock_reports;

-- Create the policy for RLS
CREATE POLICY "Users can manage their own stock reports" ON public.stock_reports
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
