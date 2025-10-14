-- This migration creates two new database functions to power the new
-- reporting and analytics features. These functions are designed to be
-- efficient and secure.

-- Function 1: Get Monthly Fuel Sales
-- Aggregates total petrol and diesel litres sold for each of the last 12 months.
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres numeric, total_diesel_litres numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH monthly_litres AS (
    SELECT
      DATE_TRUNC('month', r.date)::date as month_start,
      (r.record -> 'machines' -> 'petrol') as petrol_machines,
      (r.record -> 'machines' -> 'diesel') as diesel_machines
    FROM day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date >= DATE_TRUNC('month', NOW() - interval '11 months')
  )
  SELECT
    ml.month_start,
    SUM(
      GREATEST(0, (m ->> 'closingReading')::numeric - (m ->> 'openingReading')::numeric)
    ) as total_petrol_litres,
    SUM(
      GREATEST(0, (d ->> 'closingReading')::numeric - (d ->> 'openingReading')::numeric)
    ) as total_diesel_litres
  FROM monthly_litres ml,
  jsonb_array_elements(ml.petrol_machines) as m,
  jsonb_array_elements(ml.diesel_machines) as d
  GROUP BY ml.month_start
  ORDER BY ml.month_start ASC;
$$;

-- Function 2: Get Account Sales Fluctuation
-- Compares sales for each account between two months and returns those
-- that cross a specified percentage threshold.
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(
    current_month_start date,
    percentage_threshold numeric
)
RETURNS TABLE(
    account_id uuid,
    account_name text,
    account_type text,
    previous_month_litres numeric,
    current_month_litres numeric,
    percentage_change numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales_data AS (
    SELECT
      (sale ->> 'accountId')::uuid as account_id,
      (sale ->> 'litres')::numeric as litres,
      r.date
    FROM day_book_records r,
    jsonb_array_elements(COALESCE(r.record -> 'deductions' -> 'creditSales', '[]'::jsonb)) as sale
    WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
    UNION ALL
    SELECT
      (sale ->> 'accountId')::uuid as account_id,
      (sale ->> 'litres')::numeric as litres,
      r.date
    FROM day_book_records r,
    jsonb_array_elements(COALESCE(r.record -> 'deductions' -> 'sviSales', '[]'::jsonb)) as sale
    WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
    UNION ALL
    SELECT
      (sale ->> 'accountId')::uuid as account_id,
      (sale ->> 'litres')::numeric as litres,
      r.date
    FROM day_book_records r,
    jsonb_array_elements(COALESCE(r.record -> 'deductions' -> 'sales0332', '[]'::jsonb)) as sale
    WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
  ),
  previous_month_sales AS (
    SELECT
      sd.account_id,
      SUM(sd.litres) as total_litres
    FROM sales_data sd
    WHERE sd.date >= (current_month_start - interval '1 month') AND sd.date < current_month_start
    GROUP BY sd.account_id
  ),
  current_month_sales AS (
    SELECT
      sd.account_id,
      SUM(sd.litres) as total_litres
    FROM sales_data sd
    WHERE sd.date >= current_month_start AND sd.date < (current_month_start + interval '1 month')
    GROUP BY sd.account_id
  )
  SELECT
    acc.id as account_id,
    acc.name as account_name,
    acc.type as account_type,
    COALESCE(prev.total_litres, 0) as previous_month_litres,
    COALESCE(curr.total_litres, 0) as current_month_litres,
    CASE
      WHEN COALESCE(prev.total_litres, 0) = 0 AND COALESCE(curr.total_litres, 0) > 0 THEN 100.0
      WHEN COALESCE(prev.total_litres, 0) > 0 THEN ROUND(( (COALESCE(curr.total_litres, 0) - prev.total_litres) / prev.total_litres ) * 100, 2)
      ELSE 0.0
    END as percentage_change
  FROM accounts acc
  LEFT JOIN previous_month_sales prev ON acc.id = prev.account_id
  LEFT JOIN current_month_sales curr ON acc.id = curr.account_id
  WHERE
    acc.user_id = auth.uid() AND
    (COALESCE(prev.total_litres, 0) > 0 OR COALESCE(curr.total_litres, 0) > 0) AND
    ABS(
      CASE
        WHEN COALESCE(prev.total_litres, 0) = 0 AND COALESCE(curr.total_litres, 0) > 0 THEN 100.0
        WHEN COALESCE(prev.total_litres, 0) > 0 THEN ((COALESCE(curr.total_litres, 0) - prev.total_litres) / prev.total_litres) * 100
        ELSE 0.0
      END
    ) >= percentage_threshold;
$$;
