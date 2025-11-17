/*
# [Fix] Correct Database Function Definitions
This migration script resolves an error where a previous migration failed because it tried to remove a database function that did not exist. It also ensures all functions are defined securely and robustly.

## Query Description:
This script uses `DROP ... IF EXISTS` to safely remove old function definitions before recreating them. This prevents errors if the functions are missing. It re-implements the `delete_all_user_data` function to correctly and safely delete all data associated with the currently logged-in user.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: false

## Structure Details:
- Drops and recreates the `delete_all_user_data` function.
- Ensures all relevant functions use `IF EXISTS` for safety.

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: The `delete_all_user_data` function operates based on the `auth.uid()` of the user calling it, ensuring users can only delete their own data.
*/

-- Safely drop the old function if it exists
DROP FUNCTION IF EXISTS public.delete_all_user_data();

-- Recreate the function to safely delete all data for the current user
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER -- Use the permissions of the user calling the function
AS $$
BEGIN
  -- Delete from tables with foreign key dependencies first
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  
  -- Finally, delete from the accounts table
  DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;


-- Safely drop other functions that might exist from previous migrations
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.get_carry_forward_balance(date);
DROP FUNCTION IF EXISTS public.delete_records_for_date(character varying);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);


-- Recreate functions with security best practices (setting search_path)

CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_settled_date date;
BEGIN
    -- Find the most recent date on or before the target date where cash was collected
    SELECT MAX(r.date)
    INTO v_last_settled_date
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date < p_target_date
      AND (r.record->>'cashCollected')::boolean = true;

    -- If no settled date is found, find the earliest record date for the user
    IF v_last_settled_date IS NULL THEN
        SELECT MIN(r.date)
        INTO v_last_settled_date
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid()
        AND r.date < p_target_date;
    END IF;

    -- If still no date, there are no prior records to carry from.
    IF v_last_settled_date IS NULL THEN
        RETURN QUERY SELECT NULL::jsonb WHERE 1=0; -- Return empty set
    ELSE
        -- Return all records from the last settled date up to the day before the target date
        RETURN QUERY
        SELECT r.record
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid()
          AND r.date >= v_last_settled_date
          AND r.date < p_target_date
        ORDER BY r.date ASC;
    END IF;
END;
$$;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;


CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.payments_received WHERE date = record_date AND user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = public;


CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
  record_type text;
  record_date date;
  item_id text;
  day_book_record jsonb;
BEGIN
  parts := string_to_array(p_transaction_id, ':');
  record_type := parts[1];
  record_date := parts[2]::date;
  item_id := parts[3];

  IF record_type = 'be' THEN
    DELETE FROM public.balance_entries WHERE id = item_id AND user_id = auth.uid();
    RETURN;
  ELSIF record_type = 'pr' THEN
    DELETE FROM public.payments_received WHERE id = item_id AND user_id = auth.uid();
    RETURN;
  END IF;

  SELECT record INTO day_book_record
  FROM public.day_book_records
  WHERE date = record_date AND user_id = auth.uid();

  IF FOUND THEN
    IF record_type = 'cs' THEN
      day_book_record := jsonb_set(
        day_book_record,
        '{deductions,creditSales}',
        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'creditSales') AS elem WHERE elem->>'id' <> item_id)
      );
    ELSIF record_type = 's0' THEN
      day_book_record := jsonb_set(
        day_book_record,
        '{deductions,sales0332}',
        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sales0332') AS elem WHERE elem->>'id' <> item_id)
      );
    ELSIF record_type = 'sv' THEN
      day_book_record := jsonb_set(
        day_book_record,
        '{deductions,sviSales}',
        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sviSales') AS elem WHERE elem->>'id' <> item_id)
      );
    ELSIF record_type LIKE 'ct_%' THEN
      day_book_record := jsonb_set(
        day_book_record,
        '{cashTransactions}',
        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'cashTransactions') AS elem WHERE elem->>'id' <> item_id)
      );
    END IF;

    UPDATE public.day_book_records
    SET record = day_book_record
    WHERE date = record_date AND user_id = auth.uid();
  END IF;
END;
$$;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;


CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres numeric, total_diesel_litres numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('month', r.date)::date AS month_start,
    SUM(
      (SELECT SUM(
        GREATEST(0, (m->>'closingReading')::numeric - (m->>'openingReading')::numeric)
      ) FROM jsonb_array_elements(r.record->'machines'->'petrol') AS m)
    )::numeric AS total_petrol_litres,
    SUM(
      (SELECT SUM(
        GREATEST(0, (m->>'closingReading')::numeric - (m->>'openingReading')::numeric)
      ) FROM jsonb_array_elements(r.record->'machines'->'diesel') AS m)
    )::numeric AS total_diesel_litres
  FROM public.day_book_records r
  WHERE r.user_id = auth.uid() AND r.date >= date_trunc('month', now()) - interval '11 months'
  GROUP BY month_start
  ORDER BY month_start;
END;
$$;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;


CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres numeric, current_month_litres numeric, percentage_change real)
LANGUAGE plpgsql
AS $$
DECLARE
  previous_month_start date := current_month_start - interval '1 month';
  previous_month_end date := current_month_start - interval '1 day';
  current_month_end date := current_month_start + interval '1 month' - interval '1 day';
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT
      dbr.date,
      (sale->>'accountId')::uuid AS acc_id,
      (sale->>'litres')::numeric AS litres
    FROM public.day_book_records dbr,
         jsonb_array_elements(
           COALESCE(dbr.record->'deductions'->'creditSales', '[]'::jsonb) ||
           COALESCE(dbr.record->'deductions'->'sales0332', '[]'::jsonb) ||
           COALESCE(dbr.record->'deductions'->'sviSales', '[]'::jsonb)
         ) AS sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
  ),
  monthly_litres AS (
    SELECT
      acc_id,
      SUM(CASE WHEN date >= previous_month_start AND date <= previous_month_end THEN litres ELSE 0 END) AS prev_month_litres,
      SUM(CASE WHEN date >= current_month_start AND date <= current_month_end THEN litres ELSE 0 END) AS curr_month_litres
    FROM sales_data
    GROUP BY acc_id
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type::text AS account_type,
    ml.prev_month_litres AS previous_month_litres,
    ml.curr_month_litres AS current_month_litres,
    CASE
      WHEN ml.prev_month_litres = 0 AND ml.curr_month_litres > 0 THEN 100.0
      WHEN ml.prev_month_litres > 0 THEN ((ml.curr_month_litres - ml.prev_month_litres) / ml.prev_month_litres) * 100.0
      ELSE 0.0
    END::real AS percentage_change
  FROM monthly_litres ml
  JOIN public.accounts a ON ml.acc_id = a.id
  WHERE
    (ml.prev_month_litres > 0 AND ABS(((ml.curr_month_litres - ml.prev_month_litres) / ml.prev_month_litres) * 100.0) >= percentage_threshold)
    OR (ml.prev_month_litres = 0 AND ml.curr_month_litres > 0 AND 100.0 >= percentage_threshold);
END;
$$;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;


CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Debits from Day Book
    SELECT
      (sale->>'accountId')::uuid AS acc_id,
      dbr.date::date,
      (sale->>'amount')::numeric AS amount,
      'debit'::text AS type
    FROM public.day_book_records dbr,
         jsonb_array_elements(
           COALESCE(dbr.record->'deductions'->'creditSales', '[]'::jsonb) ||
           COALESCE(dbr.record->'deductions'->'sales0332', '[]'::jsonb) ||
           COALESCE(dbr.record->'deductions'->'sviSales', '[]'::jsonb)
         ) AS sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    UNION ALL
    -- Credits from Payments Received
    SELECT
      pr.account_id AS acc_id,
      pr.date::date,
      pr.amount,
      'credit'::text AS type
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()
  ),
  account_balances AS (
    SELECT
      acc_id,
      SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END) AS balance
    FROM all_transactions
    GROUP BY acc_id
    HAVING SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END) > 0
  ),
  aged_debits AS (
    SELECT
      t.acc_id,
      t.date,
      t.amount,
      (SELECT SUM(amount) FROM all_transactions WHERE acc_id = t.acc_id AND type = 'credit' AND date >= t.date) AS credits_after_debit
    FROM all_transactions t
    WHERE t.type = 'debit' AND t.acc_id IN (SELECT acc_id FROM account_balances)
  ),
  outstanding_debits AS (
    SELECT
      acc_id,
      date,
      GREATEST(0, amount - COALESCE(credits_after_debit, 0)) AS outstanding_amount
    FROM aged_debits
    WHERE GREATEST(0, amount - COALESCE(credits_after_debit, 0)) > 0
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type::text AS account_type,
    SUM(od.outstanding_amount)::numeric AS total_outstanding,
    SUM(CASE WHEN current_date - od.date <= 30 THEN od.outstanding_amount ELSE 0 END)::numeric AS days_0_30,
    SUM(CASE WHEN current_date - od.date > 30 AND current_date - od.date <= 60 THEN od.outstanding_amount ELSE 0 END)::numeric AS days_31_60,
    SUM(CASE WHEN current_date - od.date > 60 AND current_date - od.date <= 90 THEN od.outstanding_amount ELSE 0 END)::numeric AS days_61_90,
    SUM(CASE WHEN current_date - od.date > 90 THEN od.outstanding_amount ELSE 0 END)::numeric AS days_over_90
  FROM outstanding_debits od
  JOIN public.accounts a ON od.acc_id = a.id
  GROUP BY a.id, a.name, a.type
  ORDER BY total_outstanding DESC;
END;
$$;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;
