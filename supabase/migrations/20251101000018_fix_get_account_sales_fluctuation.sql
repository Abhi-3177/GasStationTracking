/*
          # [Fix] Correct Return Type for get_account_sales_fluctuation

          [This script corrects a type mismatch in the `get_account_sales_fluctuation` database function. The function was incorrectly returning a `text` value for the `account_type` column instead of the required `public.account_type` enum. This script replaces the function with a corrected version that returns the proper data type, resolving the migration error.]

          ## Query Description: [This operation is safe and non-destructive. It replaces an existing database function with a corrected version. It does not alter any of your stored data (tables, records, etc.). No backup is required.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Function Modified: `public.get_account_sales_fluctuation(date, real)`
          
          ## Security Implications:
          - RLS Status: [Not Applicable]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [Not Applicable]
          - Triggers: [Not Applicable]
          - Estimated Impact: [None. This is a function definition change.]
          */
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(p_current_month_start date, p_percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, previous_month_litres numeric, current_month_litres numeric, percentage_change real)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH all_sales AS (
    -- Unnest creditSales
    SELECT (sale->>'accountId')::uuid as acc_id, (sale->>'litres')::numeric as litres, (dbr.record->>'date')::date as sale_date
    FROM day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'creditSales') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    UNION ALL
    -- Unnest sviSales
    SELECT (sale->>'accountId')::uuid, (sale->>'litres')::numeric, (dbr.record->>'date')::date
    FROM day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'sviSales') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    UNION ALL
    -- Unnest sales0332
    SELECT (sale->>'accountId')::uuid, (sale->>'litres')::numeric, (dbr.record->>'date')::date
    FROM day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'sales0332') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
  ),
  monthly_sales AS (
    SELECT
      s.acc_id,
      date_trunc('month', s.sale_date) as month,
      sum(s.litres) as total_litres
    FROM all_sales s
    WHERE s.sale_date >= date_trunc('month', p_current_month_start) - interval '1 month'
      AND s.sale_date < date_trunc('month', p_current_month_start) + interval '1 month'
    GROUP BY 1, 2
  ),
  sales_comparison AS (
    SELECT
      ms.acc_id,
      sum(ms.total_litres) FILTER (WHERE ms.month = date_trunc('month', p_current_month_start) - interval '1 month') as previous_litres,
      sum(ms.total_litres) FILTER (WHERE ms.month = date_trunc('month', p_current_month_start)) as current_litres
    FROM monthly_sales ms
    GROUP BY 1
  )
  SELECT
    sc.acc_id,
    a.name,
    a.type, -- Correctly select the column of type `account_type`
    COALESCE(sc.previous_litres, 0)::numeric,
    COALESCE(sc.current_litres, 0)::numeric,
    (CASE
      WHEN COALESCE(sc.previous_litres, 0) = 0 THEN
        CASE WHEN COALESCE(sc.current_litres, 0) > 0 THEN 9999 ELSE 0 END
      ELSE
        ((COALESCE(sc.current_litres, 0) - COALESCE(sc.previous_litres, 0)) / COALESCE(sc.previous_litres, 0)) * 100
    END)::real as perc_change
  FROM sales_comparison sc
  JOIN accounts a ON sc.acc_id = a.id
  WHERE
    (COALESCE(sc.previous_litres, 0) > 0 OR COALESCE(sc.current_litres, 0) > 0)
    AND
    abs(
      (CASE
        WHEN COALESCE(sc.previous_litres, 0) = 0 THEN
          CASE WHEN COALESCE(sc.current_litres, 0) > 0 THEN 9999 ELSE 0 END
        ELSE
          ((COALESCE(sc.current_litres, 0) - COALESCE(sc.previous_litres, 0)) / COALESCE(sc.previous_litres, 0)) * 100
      END)
    ) >= p_percentage_threshold;
END;
$$;
