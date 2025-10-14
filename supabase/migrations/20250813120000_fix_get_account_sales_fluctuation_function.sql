/*
# [Fix] Correct `get_account_sales_fluctuation` Function

This migration script corrects a critical error in the `get_account_sales_fluctuation` database function. The previous scripts created conflicting function definitions, leading to a "function does not exist" error during migrations.

## Query Description:
- **DROP IF EXISTS**: The script first safely removes any potentially conflicting versions of the `get_account_sales_fluctuation` function to ensure a clean state.
- **CREATE OR REPLACE**: It then recreates the function with the correct, unambiguous signature and includes the `SET search_path` directive for enhanced security, resolving the underlying issue and a potential security warning in one step.

This operation is safe and will not result in data loss. It only replaces a piece of database logic.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by dropping the function)

## Structure Details:
- Affects function: `public.get_account_sales_fluctuation`

## Security Implications:
- RLS Status: Not Applicable
- Policy Changes: No
- Auth Requirements: The function is defined with `SECURITY DEFINER` and correctly uses `auth.uid()`.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible.
*/

-- Drop potentially conflicting old versions of the function to ensure a clean state.
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, numeric);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(text, integer);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(text, numeric);

-- Recreate the function with the correct signature and security settings.
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(
    p_current_month_start date,
    p_percentage_threshold real
)
RETURNS TABLE (
    account_id uuid,
    account_name text,
    account_type text,
    previous_month_litres numeric,
    current_month_litres numeric,
    percentage_change numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_previous_month_start date;
    v_current_month_end date;
BEGIN
    v_previous_month_start := p_current_month_start - interval '1 month';
    v_current_month_end := p_current_month_start + interval '1 month' - interval '1 day';

    RETURN QUERY
    WITH monthly_sales AS (
        -- Aggregate sales from all three credit sources
        SELECT
            dbr.user_id,
            (sale ->> 'accountId')::uuid AS acc_id,
            SUM((sale ->> 'litres')::numeric) AS total_litres,
            date_trunc('month', dbr.date)::date AS month
        FROM 
            public.day_book_records dbr,
            jsonb_array_elements(
                COALESCE(dbr.record -> 'deductions' -> 'creditSales', '[]'::jsonb) ||
                COALESCE(dbr.record -> 'deductions' -> 'sviSales', '[]'::jsonb) ||
                COALESCE(dbr.record -> 'deductions' -> 'sales0332', '[]'::jsonb)
            ) sale
        WHERE
            dbr.date >= v_previous_month_start AND dbr.date <= v_current_month_end
            AND sale ->> 'accountId' IS NOT NULL
        GROUP BY 
            dbr.user_id, acc_id, month
    ),
    sales_comparison AS (
        SELECT
            s.user_id,
            s.acc_id,
            SUM(CASE WHEN s.month = v_previous_month_start THEN s.monthly_total ELSE 0 END) AS previous_month_total,
            SUM(CASE WHEN s.month = p_current_month_start THEN s.monthly_total ELSE 0 END) AS current_month_total
        FROM (
            SELECT user_id, acc_id, month, SUM(total_litres) as monthly_total
            FROM monthly_sales
            GROUP BY user_id, acc_id, month
        ) s
        GROUP BY s.user_id, s.acc_id
    )
    SELECT
        a.id AS account_id,
        a.name AS account_name,
        a.type AS account_type,
        sc.previous_month_total AS previous_month_litres,
        sc.current_month_total AS current_month_litres,
        CASE
            WHEN sc.previous_month_total > 0 THEN
                round(((sc.current_month_total - sc.previous_month_total) / sc.previous_month_total * 100)::numeric, 2)
            ELSE
                CASE WHEN sc.current_month_total > 0 THEN 100.00 ELSE 0.00 END
        END AS percentage_change
    FROM
        sales_comparison sc
    JOIN
        public.accounts a ON sc.acc_id = a.id
    WHERE
        sc.user_id = auth.uid()
        AND (sc.previous_month_total > 0 OR sc.current_month_total > 0)
        AND abs(
            CASE
                WHEN sc.previous_month_total > 0 THEN
                    ((sc.current_month_total - sc.previous_month_total) / sc.previous_month_total * 100)
                ELSE
                    CASE WHEN sc.current_month_total > 0 THEN 100.00 ELSE 0.00 END
            END
        ) >= p_percentage_threshold;
END;
$$;
