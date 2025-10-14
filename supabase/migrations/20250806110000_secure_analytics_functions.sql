/*
# [Function Security Hardening]
Updates analytical functions to set a secure search_path, resolving security advisories.

## Query Description: 
This operation will drop and recreate three database functions: `get_monthly_fuel_sales`, `get_account_sales_fluctuation`, and `get_aged_debtors_report`. The new versions include a `SET search_path` clause, which is a security best practice to prevent potential SQL injection vectors. This change does not affect any stored data and is safe to run.

## Metadata:
- Schema-Category: ["Safe", "Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: false (but old function definitions can be restored from previous migrations)

## Structure Details:
- Drops and recreates `get_monthly_fuel_sales()`
- Drops and recreates `get_account_sales_fluctuation(date, real)`
- Drops and recreates `get_aged_debtors_report()`

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: None
- Resolves `Function Search Path Mutable` warnings for these functions.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. Function performance remains the same.
*/

-- Drop the old, insecure functions first to avoid conflicts.
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();


-- Recreate get_monthly_fuel_sales with secure search_path
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start text, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT date_trunc('month', generate_series(
      date_trunc('month', NOW() - interval '11 months'),
      date_trunc('month', NOW()),
      '1 month'
    ))::date AS month_start
  ),
  sales AS (
    SELECT 
      date_trunc('month', dbr.date)::date as month_start,
      (jsonb_path_query_array(dbr.record, '$.machines.petrol[*]')) as petrol_machines,
      (jsonb_path_query_array(dbr.record, '$.machines.diesel[*]')) as diesel_machines
    FROM day_book_records dbr
    WHERE dbr.date >= date_trunc('month', NOW() - interval '11 months')::date
      AND dbr.user_id = auth.uid()
  ),
  litres AS (
    SELECT
      s.month_start,
      COALESCE(SUM(GREATEST(0, (p.reading->>'closingReading')::double precision - (p.reading->>'openingReading')::double precision)), 0) as petrol_litres,
      0::double precision as diesel_litres
    FROM sales s, jsonb_array_elements(s.petrol_machines) as p(reading)
    GROUP BY s.month_start
    UNION ALL
    SELECT
      s.month_start,
      0::double precision as petrol_litres,
      COALESCE(SUM(GREATEST(0, (d.reading->>'closingReading')::double precision - (d.reading->>'openingReading')::double precision)), 0) as diesel_litres
    FROM sales s, jsonb_array_elements(s.diesel_machines) as d(reading)
    GROUP BY s.month_start
  )
  SELECT 
    to_char(m.month_start, 'YYYY-MM-DD') as month_start,
    COALESCE(SUM(l.petrol_litres), 0) as total_petrol_litres,
    COALESCE(SUM(l.diesel_litres), 0) as total_diesel_litres
  FROM months m
  LEFT JOIN litres l ON m.month_start = l.month_start
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$
SET search_path = public;

-- Recreate get_account_sales_fluctuation with secure search_path
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres double precision, current_month_litres double precision, percentage_change real)
LANGUAGE plpgsql
AS $$
DECLARE
  previous_month_start date := current_month_start - interval '1 month';
  current_month_end date := current_month_start + interval '1 month' - interval '1 day';
  previous_month_end date := previous_month_start + interval '1 month' - interval '1 day';
BEGIN
  RETURN QUERY
  WITH monthly_sales AS (
    SELECT
      (sale->>'accountId')::uuid as acc_id,
      date_trunc('month', dbr.date)::date as month,
      SUM((sale->>'litres')::double precision) as total_litres
    FROM 
      day_book_records dbr,
      jsonb_array_elements(dbr.record->'deductions'->'creditSales') as sale
    WHERE 
      dbr.user_id = auth.uid() AND
      dbr.date BETWEEN previous_month_start AND current_month_end AND
      sale->>'accountId' IS NOT NULL
    GROUP BY acc_id, month
    UNION ALL
    SELECT
      (sale->>'accountId')::uuid as acc_id,
      date_trunc('month', dbr.date)::date as month,
      SUM((sale->>'litres')::double precision) as total_litres
    FROM 
      day_book_records dbr,
      jsonb_array_elements(dbr.record->'deductions'->'sales0332') as sale
    WHERE 
      dbr.user_id = auth.uid() AND
      dbr.date BETWEEN previous_month_start AND current_month_end AND
      sale->>'accountId' IS NOT NULL
    GROUP BY acc_id, month
    UNION ALL
    SELECT
      (sale->>'accountId')::uuid as acc_id,
      date_trunc('month', dbr.date)::date as month,
      SUM((sale->>'litres')::double precision) as total_litres
    FROM 
      day_book_records dbr,
      jsonb_array_elements(dbr.record->'deductions'->'sviSales') as sale
    WHERE 
      dbr.user_id = auth.uid() AND
      dbr.date BETWEEN previous_month_start AND current_month_end AND
      sale->>'accountId' IS NOT NULL
    GROUP BY acc_id, month
  ),
  aggregated_sales AS (
    SELECT acc_id, month, SUM(total_litres) as total_litres
    FROM monthly_sales
    GROUP BY acc_id, month
  ),
  comparison AS (
    SELECT
      a.id as account_id,
      a.name as account_name,
      a.type as account_type,
      COALESCE((SELECT total_litres FROM aggregated_sales WHERE acc_id = a.id AND month = previous_month_start), 0) as previous_month_litres,
      COALESCE((SELECT total_litres FROM aggregated_sales WHERE acc_id = a.id AND month = current_month_start), 0) as current_month_litres
    FROM accounts a
    WHERE a.user_id = auth.uid()
  )
  SELECT
    c.account_id,
    c.account_name,
    c.account_type,
    c.previous_month_litres,
    c.current_month_litres,
    CASE
      WHEN c.previous_month_litres > 0 THEN
        ((c.current_month_litres - c.previous_month_litres) / c.previous_month_litres * 100)::real
      WHEN c.current_month_litres > 0 THEN
        100.0::real
      ELSE
        0.0::real
    END as percentage_change
  FROM comparison c
  WHERE 
    (c.previous_month_litres > 0 AND abs(((c.current_month_litres - c.previous_month_litres) / c.previous_month_litres * 100)) >= percentage_threshold)
    OR (c.previous_month_litres = 0 AND c.current_month_litres > 0);
END;
$$
SET search_path = public;

-- Recreate get_aged_debtors_report with secure search_path
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
      -- Debits from balance_entries
      SELECT b.account_id, b.date, b.amount AS amount
      FROM balance_entries b
      WHERE b.type = 'debit' AND b.user_id = auth.uid()
      UNION ALL
      -- Debits from day_book_records (creditSales, sales0332, sviSales)
      SELECT (sale->>'accountId')::uuid, dbr.date, (sale->>'amount')::numeric
      FROM day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'creditSales') sale
      WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
      UNION ALL
      SELECT (sale->>'accountId')::uuid, dbr.date, (sale->>'amount')::numeric
      FROM day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'sales0332') sale
      WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
      UNION ALL
      SELECT (sale->>'accountId')::uuid, dbr.date, (sale->>'amount'):_numeric
      FROM day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'sviSales') sale
      WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
      UNION ALL
      -- Debits from cash transactions (out)
      SELECT (ct->>'accountId')::uuid, dbr.date, (ct->>'amount')::numeric
      FROM day_book_records dbr, jsonb_array_elements(dbr.record->'cashTransactions') ct
      WHERE dbr.user_id = auth.uid() AND ct->>'accountId' IS NOT NULL AND ct->>'type' = 'out'
      UNION ALL
      -- Credits from balance_entries
      SELECT b.account_id, b.date, -b.amount
      FROM balance_entries b
      WHERE b.type = 'credit' AND b.user_id = auth.uid()
      UNION ALL
      -- Credits from payments_received
      SELECT p.account_id, p.date, -p.amount
      FROM payments_received p
      WHERE p.user_id = auth.uid()
      UNION ALL
      -- Credits from cash transactions (in)
      SELECT (ct->>'accountId')::uuid, dbr.date, -(ct->>'amount')::numeric
      FROM day_book_records dbr, jsonb_array_elements(dbr.record->'cashTransactions') ct
      WHERE dbr.user_id = auth.uid() AND ct->>'accountId' IS NOT NULL AND ct->>'type' = 'in'
  ),
  aged_debts AS (
      SELECT
          t.account_id,
          t.date,
          t.amount,
          (current_date - t.date::date) as age
      FROM all_transactions t
  ),
  account_balances AS (
      SELECT
          ad.account_id,
          SUM(ad.amount) as total_outstanding,
          SUM(CASE WHEN ad.age &lt;= 30 THEN ad.amount ELSE 0 END) as days_0_30,
          SUM(CASE WHEN ad.age > 30 AND ad.age &lt;= 60 THEN ad.amount ELSE 0 END) as days_31_60,
          SUM(CASE WHEN ad.age > 60 AND ad.age &lt;= 90 THEN ad.amount ELSE 0 END) as days_61_90,
          SUM(CASE WHEN ad.age > 90 THEN ad.amount ELSE 0 END) as days_over_90
      FROM aged_debts ad
      GROUP BY ad.account_id
  )
  SELECT 
      ab.account_id,
      a.name::text as account_name,
      a.type::text as account_type,
      ab.total_outstanding,
      ab.days_0_30,
      ab.days_31_60,
      ab.days_61_90,
      ab.days_over_90
  FROM account_balances ab
  JOIN accounts a ON ab.account_id = a.id
  WHERE ab.total_outstanding > 0
  ORDER BY ab.total_outstanding DESC;
END;
$$
SET search_path = public;
