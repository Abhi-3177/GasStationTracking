/*
          # [Master Function Reset]
          This script provides a comprehensive reset for all custom database functions. It addresses a series of migration failures related to missing types, incorrect function definitions, and critical security vulnerabilities.

          ## Query Description: [This operation will safely drop and recreate all custom functions and the 'account_type' enum. It is designed to be a definitive fix for persistent migration errors and to resolve all function-related security advisories. No user data will be lost, but it will reset the database's procedural logic to a known good state.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Drops and recreates the 'account_type' ENUM.
          - Drops and recreates all 9 custom database functions.
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          - This script explicitly sets all functions to 'SECURITY INVOKER' to fix a critical 'SECURITY DEFINER' vulnerability.
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [Low. This is a one-time structural change.]
          */

-- Step 1: Drop all existing custom functions to prevent conflicts.
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);

-- Step 2: Drop the custom type if it exists.
DROP TYPE IF EXISTS public.account_type;

-- Step 3: Create the custom ENUM type.
CREATE TYPE public.account_type AS ENUM ('factory', 'transporter');

-- Step 4: Recreate all functions with the correct definitions and security settings.

-- Function: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Delete from tables referencing the user
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
  
  -- Finally, delete the user's profile
  DELETE FROM public.profiles WHERE id = auth.uid();
END;
$$;
ALTER FUNCTION public.delete_all_user_data() SET search_path = '';

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
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = '';

-- Function: delete_transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  parts TEXT[];
  table_prefix TEXT;
  record_id TEXT;
BEGIN
  parts := string_to_array(p_transaction_id, ':');
  table_prefix := parts[1];
  record_id := parts[2];

  IF table_prefix = 'be' THEN
    DELETE FROM public.balance_entries WHERE id = record_id AND user_id = auth.uid();
  ELSIF table_prefix = 'pr' THEN
    DELETE FROM public.payments_received WHERE id = record_id AND user_id = auth.uid();
  ELSE
    -- For transactions embedded in day_book_records JSON
    UPDATE public.day_book_records
    SET record = record - '{deductions,creditSales,id}' || record_id
    WHERE user_id = auth.uid();
  END IF;
END;
$$;
ALTER FUNCTION public.delete_transaction(text) SET search_path = '';

-- Function: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres real, total_diesel_litres real)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    date_trunc('month', r.date::date)::date AS month_start,
    sum(
      (
        SELECT sum(
          (m->>'closingReading')::real - (m->>'openingReading')::real
        )
        FROM jsonb_array_elements(r.record->'machines'->'petrol') AS m
      )
    )::real AS total_petrol_litres,
    sum(
      (
        SELECT sum(
          (m->>'closingReading')::real - (m->>'openingReading')::real
        )
        FROM jsonb_array_elements(r.record->'machines'->'diesel') AS m
      )
    )::real AS total_diesel_litres
  FROM public.day_book_records r
  WHERE r.user_id = auth.uid()
  GROUP BY month_start
  ORDER BY month_start DESC
  LIMIT 12;
$$;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = '';

-- Function: get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, previous_month_litres real, current_month_litres real, percentage_change real)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH monthly_sales AS (
  SELECT
    s.accountId AS account_id,
    date_trunc('month', r.date::date)::date AS month,
    sum((s.litres)::real) AS total_litres
  FROM
    public.day_book_records r,
    jsonb_to_recordset(r.record->'deductions'->'creditSales') AS s(accountId uuid, litres text)
  WHERE r.user_id = auth.uid()
  GROUP BY s.accountId, month
),
current_month_sales AS (
  SELECT account_id, total_litres FROM monthly_sales WHERE month = current_month_start
),
previous_month_sales AS (
  SELECT account_id, total_litres FROM monthly_sales WHERE month = current_month_start - interval '1 month'
)
SELECT
  a.id AS account_id,
  a.name AS account_name,
  a.type::public.account_type,
  COALESCE(pms.total_litres, 0)::real AS previous_month_litres,
  COALESCE(cms.total_litres, 0)::real AS current_month_litres,
  (CASE
    WHEN COALESCE(pms.total_litres, 0) = 0 THEN
      CASE WHEN COALESCE(cms.total_litres, 0) > 0 THEN 100.0 ELSE 0.0 END
    ELSE
      ((COALESCE(cms.total_litres, 0) - pms.total_litres) / pms.total_litres) * 100
  END)::real AS percentage_change
FROM
  public.accounts a
LEFT JOIN
  current_month_sales cms ON a.id = cms.account_id
LEFT JOIN
  previous_month_sales pms ON a.id = pms.account_id
WHERE
  a.user_id = auth.uid() AND
  ABS(
    (CASE
      WHEN COALESCE(pms.total_litres, 0) = 0 THEN
        CASE WHEN COALESCE(cms.total_litres, 0) > 0 THEN 100.0 ELSE 0.0 END
      ELSE
        ((COALESCE(cms.total_litres, 0) - pms.total_litres) / pms.total_litres) * 100
    END)
  ) >= percentage_threshold;
$$;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = '';

-- Function: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH all_transactions AS (
    -- Debits from credit sales
    SELECT
        (sale->>'accountId')::uuid as account_id,
        (sale->>'amount')::numeric as amount,
        r.date::date as tx_date,
        'debit' as type
    FROM public.day_book_records r, jsonb_array_elements(r.record->'deductions'->'creditSales') as sale
    WHERE r.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    UNION ALL
    -- Debits from balance entries
    SELECT
        be.account_id,
        be.amount,
        be.date::date,
        'debit'
    FROM public.balance_entries be
    WHERE be.user_id = auth.uid() AND be.type = 'debit'
    UNION ALL
    -- Credits from payments received
    SELECT
        pr.account_id,
        pr.amount,
        pr.date::date,
        'credit'
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()
),
account_balances AS (
    SELECT
        account_id,
        SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END) as balance
    FROM all_transactions
    GROUP BY account_id
    HAVING SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END) > 0
),
aged_debits AS (
    SELECT
        t.account_id,
        SUM(CASE WHEN current_date - t.tx_date <= 30 THEN t.amount ELSE 0 END) as days_0_30,
        SUM(CASE WHEN current_date - t.tx_date > 30 AND current_date - t.tx_date <= 60 THEN t.amount ELSE 0 END) as days_31_60,
        SUM(CASE WHEN current_date - t.tx_date > 60 AND current_date - t.tx_date <= 90 THEN t.amount ELSE 0 END) as days_61_90,
        SUM(CASE WHEN current_date - t.tx_date > 90 THEN t.amount ELSE 0 END) as days_over_90
    FROM all_transactions t
    WHERE t.type = 'debit' AND t.account_id IN (SELECT account_id FROM account_balances)
    GROUP BY t.account_id
)
SELECT
    a.id as account_id,
    a.name as account_name,
    a.type::public.account_type,
    ab.balance as total_outstanding,
    COALESCE(ad.days_0_30, 0) as days_0_30,
    COALESCE(ad.days_31_60, 0) as days_31_60,
    COALESCE(ad.days_61_90, 0) as days_61_90,
    COALESCE(ad.days_over_90, 0) as days_over_90
FROM public.accounts a
JOIN account_balances ab ON a.id = ab.account_id
LEFT JOIN aged_debits ad ON a.id = ad.account_id
WHERE a.user_id = auth.uid()
ORDER BY ab.balance DESC;
$$;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = '';

-- Function: get_records_for_carry_forward
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
    last_settled_date date;
BEGIN
    SELECT MAX(r.date::date)
    INTO last_settled_date
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND (r.record->>'cashCollected')::boolean = true
      AND r.date::date < p_target_date;

    IF last_settled_date IS NULL THEN
        SELECT MIN(r.date::date)
        INTO last_settled_date
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid()
          AND r.date::date < p_target_date;
    END IF;

    RETURN QUERY
    SELECT r.record
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date::date >= COALESCE(last_settled_date, '1970-01-01')
      AND r.date::date < p_target_date
    ORDER BY r.date::date ASC;
END;
$$;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = '';

-- Function: bulk_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    account jsonb;
    new_account_id uuid;
BEGIN
    FOR account IN SELECT * FROM jsonb_array_elements(accounts_data)
    LOOP
        INSERT INTO public.accounts (user_id, name, type, contact, address)
        VALUES (
            auth.uid(),
            account->>'name',
            (account->>'type')::public.account_type,
            account->>'contact',
            account->>'address'
        )
        RETURNING id INTO new_account_id;

        IF (account->>'openingBalance')::numeric > 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                current_date,
                'Opening Balance',
                'debit',
                (account->>'openingBalance')::numeric
            );
        END IF;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = '';

-- Function: bulk_add_payments_and_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    payment jsonb;
    acc_id uuid;
BEGIN
    FOR payment IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        SELECT id INTO acc_id FROM public.accounts WHERE user_id = auth.uid() AND name = payment->>'account_name';

        IF acc_id IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment->>'account_name', 'factory')
            RETURNING id INTO acc_id;
        END IF;

        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number)
        VALUES (
            p_date,
            auth.uid(),
            acc_id,
            (payment->>'amount')::numeric,
            payment->>'description',
            payment->>'receipt_number'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = '';
