/*
          # [Master Function Security Reset]
          This script performs a full reset of all custom database functions to resolve persistent security advisories and ensure correct behavior.

          ## Query Description: [This operation will drop and recreate all custom functions. It is designed to be safe and non-destructive to your data, but it modifies the database's procedural logic. It is a critical step to fix application bugs related to data access and calculations.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Drops all 9 custom functions if they exist.
          - Recreates all 9 custom functions with explicit `SECURITY INVOKER` and `SET search_path = ''` clauses.
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [This script fixes a critical issue where functions were not respecting user authentication and RLS policies.]
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [Negligible performance impact. This is a structural and security change.]
          */

-- Step 1: Safely drop all existing custom functions to ensure a clean slate.

DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);


-- Step 2: Recreate all functions with proper SECURITY INVOKER and search_path settings.

-- Function to delete all data for the currently authenticated user.
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Delete from tables that reference other tables first
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  
  -- Delete from main data tables
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  
  -- Delete from accounts table last as it is referenced by others
  DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$;

-- Function to delete records for a specific date.
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Delete day book record for the given date and user
  DELETE FROM public.day_book_records
  WHERE date = record_date AND user_id = auth.uid();

  -- Delete daily record for the given date and user
  DELETE FROM public.daily_records
  WHERE date = record_date AND user_id = auth.uid();

  -- Delete payments received for the given date and user
  DELETE FROM public.payments_received
  WHERE date = record_date AND user_id = auth.uid();
END;
$$;

-- Function to delete a specific transaction by its composite ID.
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  id_parts text[];
  transaction_type text;
  real_id text;
BEGIN
  id_parts := string_to_array(p_transaction_id, ':');
  transaction_type := id_parts[1];
  real_id := id_parts[2];

  IF transaction_type = 'be' THEN
    DELETE FROM public.balance_entries WHERE id = real_id::uuid AND user_id = auth.uid();
  ELSIF transaction_type = 'pr' THEN
    DELETE FROM public.payments_received WHERE id = real_id::uuid AND user_id = auth.uid();
  END IF;
END;
$$;

-- Function to get monthly fuel sales summary.
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_sales AS (
    SELECT
      date_trunc('month', r.date::date)::date AS month_start,
      (jsonb_path_query_first(r.record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision -
      (jsonb_path_query_first(r.record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision AS petrol_litres,
      (jsonb_path_query_first(r.record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision -
      (jsonb_path_query_first(r.record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision AS diesel_litres
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date::date >= date_trunc('month', now())::date - interval '11 months'
  )
  SELECT
    ms.month_start,
    sum(ms.petrol_litres) AS total_petrol_litres,
    sum(ms.diesel_litres) AS total_diesel_litres
  FROM monthly_sales ms
  GROUP BY ms.month_start
  ORDER BY ms.month_start;
END;
$$;

-- Function to get account sales fluctuation.
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres double precision, current_month_litres double precision, percentage_change real)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  previous_month_start date := current_month_start - interval '1 month';
  previous_month_end date := current_month_start - interval '1 day';
  current_month_end date := current_month_start + interval '1 month' - interval '1 day';
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT
      (sale ->> 'accountId')::uuid AS acc_id,
      (sale ->> 'litres')::double precision AS litres,
      dbr.date::date
    FROM public.day_book_records dbr,
    jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') sale
    WHERE dbr.user_id = auth.uid()
  ),
  monthly_litres AS (
    SELECT
      sd.acc_id,
      sum(CASE WHEN sd.date >= current_month_start AND sd.date <= current_month_end THEN sd.litres ELSE 0 END) AS current_litres,
      sum(CASE WHEN sd.date >= previous_month_start AND sd.date <= previous_month_end THEN sd.litres ELSE 0 END) AS previous_litres
    FROM sales_data sd
    GROUP BY sd.acc_id
  )
  SELECT
    a.id,
    a.name,
    a.type,
    ml.previous_litres,
    ml.current_litres,
    CASE
      WHEN ml.previous_litres > 0 THEN ((ml.current_litres - ml.previous_litres) / ml.previous_litres) * 100
      ELSE 0
    END::real AS percentage_change
  FROM monthly_litres ml
  JOIN public.accounts a ON ml.acc_id = a.id
  WHERE
    (ml.previous_litres > 0 AND abs(((ml.current_litres - ml.previous_litres) / ml.previous_litres) * 100) >= percentage_threshold)
    OR (ml.previous_litres = 0 AND ml.current_litres > 0);
END;
$$;

-- Function to get aged debtors report.
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Debits from credit sales
    SELECT
      (sale ->> 'accountId')::uuid as acc_id,
      dbr.date::date as tx_date,
      (sale ->> 'amount')::numeric as amount
    FROM public.day_book_records dbr,
    jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') as sale
    WHERE dbr.user_id = auth.uid() AND (sale ->> 'accountId') IS NOT NULL
    UNION ALL
    -- Credits from payments received
    SELECT
      pr.account_id as acc_id,
      pr.date::date as tx_date,
      -pr.amount as amount
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()
  ),
  account_balances AS (
    SELECT
      acc_id,
      sum(amount) as balance
    FROM all_transactions
    GROUP BY acc_id
    HAVING sum(amount) > 0
  ),
  aged_debits AS (
    SELECT
      at.acc_id,
      at.tx_date,
      at.amount,
      sum(at.amount) OVER (PARTITION BY at.acc_id ORDER BY at.tx_date, at.amount) as cumulative_debit
    FROM all_transactions at
    WHERE at.amount > 0 AND at.acc_id IN (SELECT acc_id FROM account_balances)
  ),
  total_credits AS (
    SELECT
      acc_id,
      -sum(amount) as total_credit
    FROM all_transactions
    WHERE amount < 0
    GROUP BY acc_id
  ),
  outstanding_debits AS (
    SELECT
      ad.acc_id,
      ad.tx_date,
      CASE
        WHEN ad.cumulative_debit <= tc.total_credit THEN 0
        WHEN ad.cumulative_debit - ad.amount < tc.total_credit THEN ad.cumulative_debit - tc.total_credit
        ELSE ad.amount
      END as outstanding_amount
    FROM aged_debits ad
    JOIN total_credits tc ON ad.acc_id = tc.acc_id
  )
  SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    sum(od.outstanding_amount) as total_outstanding,
    sum(CASE WHEN current_date - od.tx_date <= 30 THEN od.outstanding_amount ELSE 0 END) as days_0_30,
    sum(CASE WHEN current_date - od.tx_date BETWEEN 31 AND 60 THEN od.outstanding_amount ELSE 0 END) as days_31_60,
    sum(CASE WHEN current_date - od.tx_date BETWEEN 61 AND 90 THEN od.outstanding_amount ELSE 0 END) as days_61_90,
    sum(CASE WHEN current_date - od.tx_date > 90 THEN od.outstanding_amount ELSE 0 END) as days_over_90
  FROM outstanding_debits od
  JOIN public.accounts a ON od.acc_id = a.id
  WHERE od.outstanding_amount > 0
  GROUP BY a.id, a.name, a.type;
END;
$$;

-- Function to get records for carry-forward calculation.
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    last_settled_date date;
BEGIN
    -- Find the most recent date on or before the target date where cash was collected
    SELECT MAX(dbr.date::date)
    INTO last_settled_date
    FROM public.day_book_records dbr
    WHERE dbr.user_id = auth.uid()
      AND dbr.date::date <= p_target_date
      AND (dbr.record ->> 'cashCollected')::boolean = true;

    -- If no settled date is found, find the earliest record date
    IF last_settled_date IS NULL THEN
        SELECT MIN(dbr.date::date)
        INTO last_settled_date
        FROM public.day_book_records dbr
        WHERE dbr.user_id = auth.uid()
          AND dbr.date::date <= p_target_date;
    END IF;

    -- Return all records from the last settled/earliest date up to the day before the target date
    RETURN QUERY
    SELECT dbr.record
    FROM public.day_book_records dbr
    WHERE dbr.user_id = auth.uid()
      AND dbr.date::date >= last_settled_date
      AND dbr.date::date < p_target_date
    ORDER BY dbr.date::date ASC;
END;
$$;

-- Function to bulk create accounts.
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    account_record jsonb;
    opening_balance_amount numeric;
BEGIN
    FOR account_record IN SELECT * FROM jsonb_array_elements(accounts_data)
    LOOP
        INSERT INTO public.accounts (user_id, name, type, contact, address)
        VALUES (
            auth.uid(),
            account_record ->> 'name',
            (account_record ->> 'type')::public.account_type,
            account_record ->> 'contact',
            account_record ->> 'address'
        )
        ON CONFLICT (user_id, name) DO NOTHING;

        opening_balance_amount := (account_record ->> 'openingBalance')::numeric;
        IF opening_balance_amount > 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            SELECT
                auth.uid(),
                id,
                CURRENT_DATE,
                'Opening Balance',
                'debit',
                opening_balance_amount
            FROM public.accounts
            WHERE user_id = auth.uid() AND name = (account_record ->> 'name');
        END IF;
    END LOOP;
END;
$$;

-- Function to bulk add payments and create accounts if they don't exist.
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    payment_record jsonb;
    account_id_var uuid;
    account_name_var text;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        account_name_var := payment_record ->> 'account_name';
        
        -- Find or create account
        SELECT id INTO account_id_var FROM public.accounts WHERE user_id = auth.uid() AND name = account_name_var;
        
        IF account_id_var IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), account_name_var, 'factory')
            RETURNING id INTO account_id_var;
        END IF;

        -- Insert payment, ignoring duplicates based on receipt number for the same user
        INSERT INTO public.payments_received (user_id, date, account_id, amount, description, receipt_number)
        VALUES (
            auth.uid(),
            p_date,
            account_id_var,
            (payment_record ->> 'amount')::numeric,
            payment_record ->> 'description',
            payment_record ->> 'receipt_number'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
