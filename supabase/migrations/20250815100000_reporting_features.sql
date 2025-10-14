-- Create a new table to store individual stock orders
CREATE TABLE IF NOT EXISTS public.stock_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('petrol', 'diesel')),
    litres NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and create policies for the new table
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own stock orders"
ON public.stock_orders
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a new function to get aged outstanding credit
CREATE OR REPLACE FUNCTION public.get_aged_outstanding_credit()
RETURNS TABLE(month_start DATE, total_outstanding NUMERIC)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This function calculates the total outstanding credit grouped by the month it originated.
    -- It's a simplified "Aged Debt" report.

    RETURN QUERY
    WITH all_transactions AS (
        -- Debits from Credit Sales
        SELECT 
            dbr.date,
            (sale->>'amount')::numeric AS amount
        FROM 
            day_book_records dbr,
            jsonb_array_elements(dbr.record->'deductions'->'creditSales') sale
        WHERE dbr.user_id = auth.uid()

        UNION ALL

        -- Debits from 0332 Sales
        SELECT 
            dbr.date,
            (sale->>'amount')::numeric AS amount
        FROM 
            day_book_records dbr,
            jsonb_array_elements(dbr.record->'deductions'->'sales0332') sale
        WHERE dbr.user_id = auth.uid()

        UNION ALL

        -- Debits from SVI Sales
        SELECT 
            dbr.date,
            (sale->>'amount')::numeric AS amount
        FROM 
            day_book_records dbr,
            jsonb_array_elements(dbr.record->'deductions'->'sviSales') sale
        WHERE dbr.user_id = auth.uid()

        UNION ALL

        -- Debits from Cash Out Transactions
        SELECT 
            dbr.date,
            (trans->>'amount')::numeric AS amount
        FROM 
            day_book_records dbr,
            jsonb_array_elements(dbr.record->'cashTransactions') trans
        WHERE dbr.user_id = auth.uid() AND trans->>'type' = 'out'

        UNION ALL

        -- Debits from Opening Balance
        SELECT 
            be.date,
            be.amount
        FROM 
            balance_entries be
        WHERE be.user_id = auth.uid() AND be.type = 'debit'
    ),
    all_credits AS (
        -- Credits from Payments Received
        SELECT 
            pr.amount
        FROM 
            payments_received pr
        WHERE pr.user_id = auth.uid()

        UNION ALL

        -- Credits from Cash In Transactions
        SELECT 
            (trans->>'amount')::numeric AS amount
        FROM 
            day_book_records dbr,
            jsonb_array_elements(dbr.record->'cashTransactions') trans
        WHERE dbr.user_id = auth.uid() AND trans->>'type' = 'in'

        UNION ALL

        -- Credits from Opening Balance
        SELECT 
            be.amount
        FROM 
            balance_entries be
        WHERE be.user_id = auth.uid() AND be.type = 'credit'
    ),
    total_credit_pool AS (
        SELECT COALESCE(SUM(c.amount), 0) as total FROM all_credits c
    ),
    unsettled_debits AS (
        SELECT
            t.date,
            t.amount,
            SUM(t.amount) OVER (ORDER BY t.date, t.amount) as cumulative_debit
        FROM all_transactions t
    )
    SELECT
        date_trunc('month', ud.date)::date as month_start,
        SUM(ud.amount) as total_outstanding
    FROM unsettled_debits ud, total_credit_pool tcp
    WHERE ud.cumulative_debit > tcp.total
    GROUP BY month_start
    ORDER BY month_start DESC;

END;
$$ LANGUAGE plpgsql;
