/*
# [Function Fix] Corrects the get_monthly_fuel_sales function signature

## Query Description: [This script resolves a migration error by safely dropping and recreating the `get_monthly_fuel_sales` database function. This ensures the function signature is correct and prevents "cannot change return type" errors during migrations.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- Drops the existing `get_monthly_fuel_sales` function.
- Recreates the `get_monthly_fuel_sales` function with the correct definition and security settings.

## Security Implications:
- RLS Status: [N/A]
- Policy Changes: [No]
- Auth Requirements: [N/A]

## Performance Impact:
- Indexes: [N/A]
- Triggers: [N/A]
- Estimated Impact: [Negligible. This is a one-time structural fix.]
*/

-- Safely drop the existing function to avoid signature conflicts.
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();

-- Recreate the function with the correct and final definition.
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres numeric, total_diesel_litres numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    -- Generate a series of the last 12 months
    SELECT generate_series(
      date_trunc('month', now() - interval '11 months'),
      date_trunc('month', now()),
      '1 month'::interval
    )::date AS month_start
  ),
  all_sales AS (
    -- Unnest and calculate petrol sales
    SELECT 
      dbr.date,
      GREATEST(0, (m->>'closingReading')::numeric - (m->>'openingReading')::numeric) as litres,
      'petrol' as fuel_type
    FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'machines'->'petrol') as m
    WHERE dbr.user_id = auth.uid() AND dbr.date >= date_trunc('month', now() - interval '11 months')
    
    UNION ALL
    
    -- Unnest and calculate diesel sales
    SELECT 
      dbr.date,
      GREATEST(0, (m->>'closingReading')::numeric - (m->>'openingReading')::numeric) as litres,
      'diesel' as fuel_type
    FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'machines'->'diesel') as m
    WHERE dbr.user_id = auth.uid() AND dbr.date >= date_trunc('month', now() - interval '11 months')
  ),
  monthly_sales AS (
    -- Aggregate all sales by month
    SELECT
      date_trunc('month', all_sales.date)::date as sale_month,
      SUM(litres) FILTER (WHERE fuel_type = 'petrol') as petrol,
      SUM(litres) FILTER (WHERE fuel_type = 'diesel') as diesel
    FROM all_sales
    GROUP BY 1
  )
  -- Join with the months series to ensure all 12 months are present, even if they have no sales
  SELECT
    m.month_start,
    COALESCE(ms.petrol, 0) as total_petrol_litres,
    COALESCE(ms.diesel, 0) as total_diesel_litres
  FROM months m
  LEFT JOIN monthly_sales ms ON m.month_start = ms.sale_month
  ORDER BY m.month_start ASC;
END;
$$;
