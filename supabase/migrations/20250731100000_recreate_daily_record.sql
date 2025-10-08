/*
          # [Recreate Daily Record Feature]
          This migration creates the necessary tables to support the new Daily Record functionality for bank reconciliation and tracking payments received.

          ## Query Description: "This operation creates two new tables: `daily_records` and `payments_received`. It is a non-destructive, structural change and is safe to run on an existing database. It also creates a trigger to automatically update timestamps."
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Creates table `public.daily_records`
          - Creates table `public.payments_received`
          - Creates trigger `on_daily_record_update`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (New policies for created tables)
          - Auth Requirements: User must be authenticated
          
          ## Performance Impact:
          - Indexes: Primary keys are indexed automatically.
          - Triggers: Adds one `BEFORE UPDATE` trigger on `daily_records`.
          - Estimated Impact: Negligible performance impact.
          */

-- Create daily_records table to store reconciliation data
CREATE TABLE public.daily_records (
    date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_reconciliation JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (date, user_id)
);

COMMENT ON TABLE public.daily_records IS 'Stores daily reconciliation data, including bank payment matching.';
COMMENT ON COLUMN public.daily_records.bank_reconciliation IS 'Stores the status of bank payments carried over from the previous day.';

-- Enable RLS and define policies for daily_records
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily records"
    ON public.daily_records FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create payments_received table
CREATE TABLE public.payments_received (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payments_received IS 'Tracks payments received from factories and transporters.';

-- Enable RLS and define policies for payments_received
ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own received payments"
    ON public.payments_received FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create a trigger to automatically update the updated_at timestamp on daily_records
CREATE OR REPLACE FUNCTION public.handle_daily_record_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_daily_record_update
    BEFORE UPDATE ON public.daily_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_daily_record_update();
