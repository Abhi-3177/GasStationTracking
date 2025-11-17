-- DO NOT APPLY PREVIOUS MIGRATIONS. THIS SCRIPT IS A COMPLETE RESET FOR ALL DATABASE FUNCTIONS.

/*
          # [Master Function Reset]
          This script provides a definitive fix for all custom database functions. It addresses persistent migration errors and critical security advisories by safely dropping all existing custom functions and recreating them with the correct logic and security settings.

          ## Query Description: [This operation will reset all custom database functions to their latest secure versions. It is designed to be safe to run even if previous migrations have failed. It first removes all old function definitions and then creates new, secure ones. No data will be lost.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: false
          - Reversible: false
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          - This script explicitly sets all functions to `SECURITY INVOKER` to fix the "Security Definer View" error and ensure all database operations respect Row Level Security.
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [Negligible. This is a metadata change.]
          */

-- Step 1: Safely drop all existing custom functions to prevent conflicts.
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);

-- Step 2: Re-create all functions with correct logic and security settings.

-- Function to get records needed for carry-forward calculation
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    last_settled_date date;
BEGIN
    -- Find the most recent date on or before the target date where cash was collected.
    SELECT MAX(r.date)
    INTO last_settled_date
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date <= p_target_date
      AND (r.record->>'cashCollected')::boolean = true;

    -- If no settled day is found, find the earliest record date for this user.
    IF last_settled_date IS NULL THEN
        SELECT MIN(r.date)
        INTO last_settled_date
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid();
    END IF;

    -- Return all records from the last settled date (or first record) up to the day before the target date.
    RETURN QUERY
    SELECT r.record
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date >= last_settled_date
      AND r.date < p_target_date
    ORDER BY r.date;
END;
$$;


-- Function to delete all data for the current user
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$;

-- Function to delete records for a specific date
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
END;
$$;

-- Function to delete a specific transaction by its composite ID
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  parts text[];
  tx_type text;
  tx_date text;
  tx_id text;
  record_jsonb jsonb;
BEGIN
  parts := string_to_array(p_transaction_id, ':');
  tx_type := parts[1];
  tx_date := parts[2];
  tx_id := parts[3];

  IF tx_type = 'be' THEN
    DELETE FROM public.balance_entries WHERE id = tx_id AND user_id = auth.uid();
  ELSIF tx_type = 'pr' THEN
    DELETE FROM public.payments_received WHERE id = tx_id AND user_id = auth.uid();
  ELSE
    SELECT record INTO record_jsonb FROM public.day_book_records WHERE date = tx_date AND user_id = auth.uid();
    IF record_jsonb IS NOT NULL THEN
      IF tx_type = 'cs' THEN
        record_jsonb := jsonb_set(record_jsonb, '{deductions,creditSales}', (SELECT jsonb_agg(elem) FROM jsonb_array_elements(record_jsonb->'deductions'->'creditSales') AS elem WHERE elem->>'id' <> tx_id));
      ELSIF tx_type = 's0' THEN
        record_jsonb := jsonb_set(record_jsonb, '{deductions,sales0332}', (SELECT jsonb_agg(elem) FROM jsonb_array_elements(record_jsonb->'deductions'->'sales0332') AS elem WHERE elem->>'id' <> tx_id));
      ELSIF tx_type = 'sv' THEN
        record_jsonb := jsonb_set(record_jsonb, '{deductions,sviSales}', (SELECT jsonb_agg(elem) FROM jsonb_array_elements(record_jsonb->'deductions'->'sviSales') AS elem WHERE elem->>'id' <> tx_id));
      ELSIF tx_type LIKE 'ct_%' THEN
        record_jsonb := jsonb_set(record_jsonb, '{cashTransactions}', (SELECT jsonb_agg(elem) FROM jsonb_array_elements(record_jsonb->'cashTransactions') AS elem WHERE elem->>'id' <> tx_id));
      END IF;
      UPDATE public.day_book_records SET record = record_jsonb WHERE date = tx_date AND user_id = auth.uid();
    END IF;
  END IF;
END;
$$;

-- Function for monthly fuel sales report
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres numeric, total_diesel_litres numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH monthly_sales AS (
    SELECT
        date_trunc('month', r.date::date) AS month_start,
        (
            SELECT COALESCE(SUM(
                GREATEST(0, (m.value->>'closingReading')::numeric - (m.value->>'openingReading')::numeric)
            ), 0)
            FROM jsonb_array_elements(r.record->'machines'->'petrol') AS m
        ) AS petrol_litres,
        (
            SELECT COALESCE(SUM(
                GREATEST(0, (m.value->>'closingReading')::numeric - (m.value->>'openingReading')::numeric)
            ), 0)
            FROM jsonb_array_elements(r.record->'machines'->'diesel') AS m
        ) AS diesel_litres
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid() AND r.date >= date_trunc('month', now() - interval '11 months')::date
)
SELECT
    ms.month_start::date,
    SUM(ms.petrol_litres) AS total_petrol_litres,
    SUM(ms.diesel_litres) AS total_diesel_litres
FROM monthly_sales ms
GROUP BY ms.month_start
ORDER BY ms.month_start ASC;
$$;

-- Function for account sales fluctuation report
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres numeric, current_month_litres numeric, percentage_change real)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH sales_data AS (
    SELECT
        s.value->>'accountId' AS account_id,
        (s.value->>'litres')::numeric AS litres,
        dbr.date::date AS sale_date
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'creditSales') s
    WHERE dbr.user_id = auth.uid() AND s.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT
        s.value->>'accountId' AS account_id,
        (s.value->>'litres')::numeric AS litres,
        dbr.date::date AS sale_date
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sales0332') s
    WHERE dbr.user_id = auth.uid() AND s.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT
        s.value->>'accountId' AS account_id,
        (s.value->>'litres')::numeric AS litres,
        dbr.date::date AS sale_date
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sviSales') s
    WHERE dbr.user_id = auth.uid() AND s.value->>'accountId' IS NOT NULL
),
monthly_litres AS (
    SELECT
        sd.account_id::uuid,
        date_trunc('month', sd.sale_date)::date AS month_start,
        SUM(sd.litres) AS total_litres
    FROM sales_data sd
    WHERE sd.sale_date >= (current_month_start - interval '1 month')
    GROUP BY sd.account_id, month_start
),
comparison AS (
    SELECT
        m.account_id,
        SUM(CASE WHEN m.month_start = (current_month_start - interval '1 month') THEN m.total_litres ELSE 0 END) AS previous_month_litres,
        SUM(CASE WHEN m.month_start = current_month_start THEN m.total_litres ELSE 0 END) AS current_month_litres
    FROM monthly_litres m
    GROUP BY m.account_id
)
SELECT
    c.account_id,
    a.name AS account_name,
    a.type AS account_type,
    c.previous_month_litres,
    c.current_month_litres,
    CASE
        WHEN c.previous_month_litres > 0 THEN
            ((c.current_month_litres - c.previous_month_litres) / c.previous_month_litres) * 100
        ELSE
            CASE WHEN c.current_month_litres > 0 THEN 100.0 ELSE 0.0 END
    END::real AS percentage_change
FROM comparison c
JOIN public.accounts a ON c.account_id = a.id
WHERE
    (c.previous_month_litres > 0 AND ABS(((c.current_month_litres - c.previous_month_litres) / c.previous_month_litres) * 100) >= percentage_threshold)
    OR (c.previous_month_litres = 0 AND c.current_month_litres > 0 AND 100 >= percentage_threshold);
$$;

-- Function for aged debtors report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH all_transactions AS (
    -- Debits
    SELECT s.value->>'accountId' AS account_id, dbr.date::date AS tx_date, (s.value->>'amount')::numeric AS amount, 'debit' as type
    FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'creditSales') s WHERE dbr.user_id = auth.uid() AND s.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT s.value->>'accountId', dbr.date::date, (s.value->>'amount')::numeric, 'debit' FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'sales0332') s WHERE dbr.user_id = auth.uid() AND s.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT s.value->>'accountId', dbr.date::date, (s.value->>'amount')::numeric, 'debit' FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'deductions'->'sviSales') s WHERE dbr.user_id = auth.uid() AND s.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT ct.value->>'accountId', dbr.date::date, (ct.value->>'amount')::numeric, 'debit' FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'cashTransactions') ct WHERE dbr.user_id = auth.uid() AND ct.value->>'type' = 'out' AND ct.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT be.account_id::text, be.date::date, be.amount, 'debit' FROM public.balance_entries be WHERE be.user_id = auth.uid() AND be.type = 'debit'
    -- Credits
    UNION ALL
    SELECT pr.account_id::text, pr.date::date, pr.amount, 'credit' FROM public.payments_received pr WHERE pr.user_id = auth.uid()
    UNION ALL
    SELECT ct.value->>'accountId', dbr.date::date, (ct.value->>'amount')::numeric, 'credit' FROM public.day_book_records dbr, jsonb_array_elements(dbr.record->'cashTransactions') ct WHERE dbr.user_id = auth.uid() AND ct.value->>'type' = 'in' AND ct.value->>'accountId' IS NOT NULL
    UNION ALL
    SELECT be.account_id::text, be.date::date, be.amount, 'credit' FROM public.balance_entries be WHERE be.user_id = auth.uid() AND be.type = 'credit'
),
outstanding_debits AS (
    SELECT
        d.account_id,
        d.tx_date,
        d.amount - COALESCE(SUM(c.amount), 0) AS remaining_balance
    FROM (SELECT * FROM all_transactions WHERE type = 'debit') d
    LEFT JOIN (SELECT * FROM all_transactions WHERE type = 'credit') c ON d.account_id = c.account_id AND c.tx_date >= d.tx_date
    GROUP BY d.account_id, d.tx_date, d.amount
    HAVING d.amount - COALESCE(SUM(c.amount), 0) > 0
)
SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    COALESCE(SUM(od.remaining_balance), 0) AS total_outstanding,
    COALESCE(SUM(CASE WHEN current_date - od.tx_date <= 30 THEN od.remaining_balance ELSE 0 END), 0) AS days_0_30,
    COALESCE(SUM(CASE WHEN current_date - od.tx_date > 30 AND current_date - od.tx_date <= 60 THEN od.remaining_balance ELSE 0 END), 0) AS days_31_60,
    COALESCE(SUM(CASE WHEN current_date - od.tx_date > 60 AND current_date - od.tx_date <= 90 THEN od.remaining_balance ELSE 0 END), 0) AS days_61_90,
    COALESCE(SUM(CASE WHEN current_date - od.tx_date > 90 THEN od.remaining_balance ELSE 0 END), 0) AS days_over_90
FROM public.accounts a
LEFT JOIN outstanding_debits od ON a.id = od.account_id::uuid
WHERE a.user_id = auth.uid()
GROUP BY a.id, a.name, a.type
HAVING COALESCE(SUM(od.remaining_balance), 0) > 0;
$$;

-- Function for bulk creating accounts
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

        IF (account_record->>'openingBalance')::numeric > 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                current_date,
                'Opening Balance',
                'debit',
                (account_record->>'openingBalance')::numeric
            );
        END IF;
    END LOOP;
END;
$$;

-- Function for bulk adding payments and creating accounts if needed
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    payment_record jsonb;
    target_account_id uuid;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        SELECT id INTO target_account_id FROM public.accounts 
        WHERE user_id = auth.uid() AND lower(name) = lower(payment_record->>'account_name');

        IF target_account_id IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment_record->>'account_name', 'factory')
            RETURNING id INTO target_account_id;
        END IF;

        INSERT INTO public.payments_received (user_id, date, account_id, amount, description, receipt_number)
        VALUES (
            auth.uid(),
            p_date,
            target_account_id,
            (payment_record->>'amount')::numeric,
            payment_record->>'description',
            payment_record->>'receipt_number'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
