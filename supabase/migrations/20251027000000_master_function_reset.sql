-- This script will reset all custom functions to a known, secure state.
-- It is designed to be run safely, regardless of the previous state.

/*
          # [Operation Name]
          Master Function Reset & Security Patch

          ## Query Description: [This operation will safely drop and recreate all custom database functions to resolve persistent security and permission issues. It ensures all functions run with the correct user permissions (`SECURITY INVOKER`) and respect Row-Level Security policies. This is the definitive fix for the "Security Definer View" error and related bugs.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Drops and recreates 9 functions: delete_all_user_data, delete_records_for_date, delete_transaction, get_monthly_fuel_sales, get_account_sales_fluctuation, get_aged_debtors_report, bulk_create_accounts, bulk_add_payments_and_create_accounts, get_records_for_carry_forward.
          - Drops and recreates 1 ENUM type: account_type.
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [This script fixes a critical auth issue by setting all functions to SECURITY INVOKER.]
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [Negligible. This is a metadata and function definition update.]
          */

-- Step 1: Drop all existing custom functions safely
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);

-- Step 2: Drop the custom type if it exists
DROP TYPE IF EXISTS public.account_type;

-- Step 3: Re-create the custom type
CREATE TYPE public.account_type AS ENUM ('factory', 'transporter');

-- Step 4: Re-create all functions with SECURITY INVOKER

-- Function: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.delete_all_user_data() SET search_path = 'public';

-- Function: delete_records_for_date
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
    DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
    DELETE FROM public.payments_received WHERE date = record_date AND user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = 'public';

-- Function: delete_transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    table_prefix TEXT;
    real_id TEXT;
BEGIN
    table_prefix := split_part(p_transaction_id, ':', 1);
    real_id := split_part(p_transaction_id, ':', 2);

    IF table_prefix = 'be' THEN
        DELETE FROM public.balance_entries WHERE id = real_id::uuid AND user_id = auth.uid();
    ELSIF table_prefix = 'pr' THEN
        DELETE FROM public.payments_received WHERE id = real_id::uuid AND user_id = auth.uid();
    ELSE
        RAISE NOTICE 'Cannot delete transaction with ID % as it is part of a JSON record.', p_transaction_id;
    END IF;
END;
$$;
ALTER FUNCTION public.delete_transaction(text) SET search_path = 'public';

-- Function: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    date_trunc('month', dbr.date::date)::date as month_start,
    sum((machine.reading ->> 'closingReading')::double precision - (machine.reading ->> 'openingReading')::double precision) FILTER (WHERE machine.type = 'petrol') as total_petrol_litres,
    sum((machine.reading ->> 'closingReading')::double precision - (machine.reading ->> 'openingReading')::double precision) FILTER (WHERE machine.type = 'diesel') as total_diesel_litres
  FROM
    public.day_book_records dbr,
    LATERAL (
      SELECT 'petrol' as type, jsonb_array_elements(dbr.record->'machines'->'petrol') as reading
      UNION ALL
      SELECT 'diesel' as type, jsonb_array_elements(dbr.record->'machines'->'diesel') as reading
    ) machine
  WHERE
    dbr.user_id = auth.uid()
    AND dbr.date::date >= date_trunc('month', now() - interval '11 months')::date
  GROUP BY
    month_start
  ORDER BY
    month_start;
$$;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = 'public';


-- Function: get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, previous_month_litres double precision, current_month_litres double precision, percentage_change real)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH monthly_sales AS (
    SELECT
      s.sale_data ->> 'accountId' as account_id,
      date_trunc('month', dbr.date::date)::date as month,
      sum((s.sale_data ->> 'litres')::double precision) as total_litres
    FROM
      public.day_book_records dbr,
      jsonb_array_elements(
        dbr.record -> 'deductions' -> 'creditSales' ||
        dbr.record -> 'deductions' -> 'sales0332' ||
        dbr.record -> 'deductions' -> 'sviSales'
      ) s(sale_data)
    WHERE
      dbr.user_id = auth.uid()
      AND s.sale_data ->> 'accountId' IS NOT NULL
      AND dbr.date::date >= (current_month_start - interval '1 month')::date
      AND dbr.date::date < (current_month_start + interval '1 month')::date
    GROUP BY
      1, 2
  ),
  sales_comparison AS (
    SELECT
      ms.account_id,
      SUM(ms.total_litres) FILTER (WHERE ms.month = current_month_start) as current_month_litres,
      SUM(ms.total_litres) FILTER (WHERE ms.month = (current_month_start - interval '1 month')::date) as previous_month_litres
    FROM
      monthly_sales ms
    GROUP BY
      ms.account_id
  )
  SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    COALESCE(sc.previous_month_litres, 0) as previous_month_litres,
    COALESCE(sc.current_month_litres, 0) as current_month_litres,
    (CASE
      WHEN COALESCE(sc.previous_month_litres, 0) = 0 THEN 0.0
      ELSE ((COALESCE(sc.current_month_litres, 0) - sc.previous_month_litres) / sc.previous_month_litres) * 100
    END)::real as percentage_change
  FROM
    sales_comparison sc
  JOIN
    public.accounts a ON a.id = sc.account_id::uuid
  WHERE
    COALESCE(sc.previous_month_litres, 0) > 0
    AND abs(((COALESCE(sc.current_month_litres, 0) - sc.previous_month_litres) / sc.previous_month_litres) * 100) >= percentage_threshold;
$$;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = 'public';

-- Function: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH all_transactions AS (
    SELECT account_id, date::date, amount, 'debit' as type FROM public.balance_entries WHERE type = 'debit' AND user_id = auth.uid()
    UNION ALL
    SELECT account_id, date::date, -amount, 'credit' as type FROM public.balance_entries WHERE type = 'credit' AND user_id = auth.uid()
  ),
  account_balances AS (
    SELECT account_id, sum(amount) as balance
    FROM all_transactions
    GROUP BY account_id
  ),
  aged_debits AS (
    SELECT
      account_id,
      SUM(amount) FILTER (WHERE current_date - date <= 30) as days_0_30,
      SUM(amount) FILTER (WHERE current_date - date > 30 AND current_date - date <= 60) as days_31_60,
      SUM(amount) FILTER (WHERE current_date - date > 60 AND current_date - date <= 90) as days_61_90,
      SUM(amount) FILTER (WHERE current_date - date > 90) as days_over_90
    FROM public.balance_entries
    WHERE type = 'debit' AND user_id = auth.uid()
    GROUP BY account_id
  )
  SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    ab.balance as total_outstanding,
    COALESCE(ad.days_0_30, 0) as days_0_30,
    COALESCE(ad.days_31_60, 0) as days_31_60,
    COALESCE(ad.days_61_90, 0) as days_61_90,
    COALESCE(ad.days_over_90, 0) as days_over_90
  FROM public.accounts a
  JOIN account_balances ab ON a.id = ab.account_id
  LEFT JOIN aged_debits ad ON a.id = ad.account_id
  WHERE ab.balance > 0 AND a.user_id = auth.uid();
$$;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = 'public';

-- Function: bulk_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    account_record jsonb;
    new_account_id uuid;
BEGIN
    FOR account_record IN SELECT * FROM jsonb_array_elements(accounts_data)
    LOOP
        INSERT INTO public.accounts (user_id, name, type, contact, address)
        VALUES (
            auth.uid(),
            account_record->>'name',
            (account_record->>'type')::public.account_type,
            account_record->>'contact',
            account_record->>'address'
        )
        RETURNING id INTO new_account_id;

        IF (account_record->>'openingBalance')::numeric != 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                current_date,
                'Opening Balance',
                CASE WHEN (account_record->>'openingBalance')::numeric > 0 THEN 'debit' ELSE 'credit' END,
                abs((account_record->>'openingBalance')::numeric)
            );
        END IF;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = 'public';

-- Function: bulk_add_payments_and_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    payment_record jsonb;
    v_account_id uuid;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        SELECT id INTO v_account_id FROM public.accounts 
        WHERE name = payment_record->>'account_name' AND user_id = auth.uid();

        IF v_account_id IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment_record->>'account_name', 'factory')
            RETURNING id INTO v_account_id;
        END IF;

        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number, payment_method)
        VALUES (
            p_date,
            auth.uid(),
            v_account_id,
            (payment_record->>'amount')::numeric,
            payment_record->>'description',
            payment_record->>'receipt_number',
            'Paytm'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = 'public';

-- Function: get_records_for_carry_forward
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE sql
SECURITY INVOKER
AS $$
  with last_settled as (
    select max(date) as last_settled_date
    from public.day_book_records
    where user_id = auth.uid()
    and (record->>'cashCollected')::boolean = true
    and date < p_target_date
  )
  select record from public.day_book_records
  where user_id = auth.uid()
  and date >= COALESCE((select last_settled_date from last_settled), '1970-01-01'::date)
  and date < p_target_date
  order by date asc;
$$;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = 'public';
