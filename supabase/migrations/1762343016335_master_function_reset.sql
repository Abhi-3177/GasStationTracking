/*
          # [MASTER RESET] Rebuild All Custom Database Functions
          [This script provides a comprehensive reset for all custom database functions, types, and their security settings. It is designed to run safely and bring the database to a known, correct, and secure state, resolving all previous migration errors and security advisories related to functions.]

          ## Query Description: [This operation will first drop all existing custom database functions and the 'account_type' enum to ensure a clean slate. It then recreates the enum and all nine functions with their correct logic and security settings (SECURITY INVOKER). This is a safe structural change and does not affect any of your stored data (like day books, accounts, or payments).]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Drops and recreates the 'account_type' ENUM.
          - Drops and recreates 9 functions: delete_all_user_data, delete_records_for_date, delete_transaction, get_monthly_fuel_sales, get_account_sales_fluctuation, get_aged_debtors_report, get_records_for_carry_forward, bulk_create_accounts, bulk_add_payments_and_create_accounts.
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [This script sets all functions to SECURITY INVOKER, which is the secure standard. This ensures all functions respect your existing Row Level Security policies.]
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [Negligible. This is a one-time structural change.]
          */

-- Step 1: Drop all existing functions and types safely
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);
DROP TYPE IF EXISTS public.account_type;

-- Step 2: Create the custom ENUM type
CREATE TYPE public.account_type AS ENUM ('factory', 'transporter');

-- Step 3: Recreate all functions with correct logic and security settings

-- Function 1: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- This function deletes all data associated with the currently authenticated user.
    DELETE FROM public.day_book_records WHERE user_id = auth.uid();
    DELETE FROM public.daily_records WHERE user_id = auth.uid();
    DELETE FROM public.balance_entries WHERE user_id = auth.uid();
    DELETE FROM public.payments_received WHERE user_id = auth.uid();
    DELETE FROM public.stock_orders WHERE user_id = auth.uid();
    DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$;

-- Function 2: delete_records_for_date
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- Deletes records for a specific date for the current user.
    DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
    DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
END;
$$;

-- Function 3: delete_transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    parts text[];
    transaction_type text;
    transaction_pk text;
    record_date date;
    day_book_id text;
    day_book_record jsonb;
BEGIN
    -- Split the combined transaction ID
    parts := string_to_array(p_transaction_id, ':');
    transaction_type := parts[1];
    
    IF transaction_type = 'be' THEN
        transaction_pk := parts[2];
        DELETE FROM public.balance_entries WHERE id = transaction_pk::uuid AND user_id = auth.uid();
    ELSIF transaction_type = 'pr' THEN
        transaction_pk := parts[2];
        DELETE FROM public.payments_received WHERE id = transaction_pk::uuid AND user_id = auth.uid();
    ELSE
        record_date := parts[2]::date;
        day_book_id := parts[3];

        -- Fetch the specific day book record
        SELECT record INTO day_book_record
        FROM public.day_book_records
        WHERE date = record_date AND user_id = auth.uid();

        IF day_book_record IS NOT NULL THEN
            IF transaction_type = 'cs' THEN
                day_book_record := jsonb_set(
                    day_book_record,
                    '{deductions,creditSales}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'creditSales') AS elem WHERE elem->>'id' <> day_book_id)
                );
            ELSIF transaction_type = 's0' THEN
                day_book_record := jsonb_set(
                    day_book_record,
                    '{deductions,sales0332}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sales0332') AS elem WHERE elem->>'id' <> day_book_id)
                );
            ELSIF transaction_type = 'sv' THEN
                 day_book_record := jsonb_set(
                    day_book_record,
                    '{deductions,sviSales}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sviSales') AS elem WHERE elem->>'id' <> day_book_id)
                );
            ELSIF transaction_type = 'ct_in' OR transaction_type = 'ct_out' THEN
                day_book_record := jsonb_set(
                    day_book_record,
                    '{cashTransactions}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'cashTransactions') AS elem WHERE elem->>'id' <> day_book_id)
                );
            END IF;

            -- Update the record in the database
            UPDATE public.day_book_records
            SET record = day_book_record
            WHERE date = record_date AND user_id = auth.uid();
        END IF;
    END IF;
END;
$$;

-- Function 4: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres real, total_diesel_litres real)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH monthly_data AS (
        SELECT
            DATE_TRUNC('month', r.date::date) as month,
            (jsonb_array_elements(r.record->'machines'->'petrol')->>'closingReading')::real -
            (jsonb_array_elements(r.record->'machines'->'petrol')->>'openingReading')::real as petrol_litres,
            (jsonb_array_elements(r.record->'machines'->'diesel')->>'closingReading')::real -
            (jsonb_array_elements(r.record->'machines'->'diesel')->>'openingReading')::real as diesel_litres
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid() AND r.date::date >= (NOW() - interval '12 months')
    )
    SELECT
        month::date,
        SUM(CASE WHEN petrol_litres > 0 THEN petrol_litres ELSE 0 END)::real as total_petrol_litres,
        SUM(CASE WHEN diesel_litres > 0 THEN diesel_litres ELSE 0 END)::real as total_diesel_litres
    FROM monthly_data
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12;
END;
$$;

-- Function 5: get_account_sales_fluctuation (Corrected Version)
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(
    current_month_start date,
    percentage_threshold real
)
RETURNS TABLE(
    account_id uuid,
    account_name text,
    account_type public.account_type,
    previous_month_litres real,
    current_month_litres real,
    percentage_change real
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    previous_month_start date;
    previous_month_end date;
    current_month_end date;
BEGIN
    previous_month_start := (current_month_start - interval '1 month');
    previous_month_end := (current_month_start - interval '1 day');
    current_month_end := (current_month_start + interval '1 month' - interval '1 day');

    RETURN QUERY
    WITH monthly_sales AS (
        SELECT
            d.account_id,
            d.date,
            SUM(d.litres) as total_litres
        FROM (
            SELECT (jsonb_array_elements(record->'deductions'->'creditSales')->>'accountId')::uuid as account_id, (jsonb_array_elements(record->'deductions'->'creditSales')->>'litres')::real as litres, r.date::date FROM public.day_book_records r WHERE r.user_id = auth.uid()
            UNION ALL
            SELECT (jsonb_array_elements(record->'deductions'->'sales0332')->>'accountId')::uuid as account_id, (jsonb_array_elements(record->'deductions'->'sales0332')->>'litres')::real as litres, r.date::date FROM public.day_book_records r WHERE r.user_id = auth.uid()
            UNION ALL
            SELECT (jsonb_array_elements(record->'deductions'->'sviSales')->>'accountId')::uuid as account_id, (jsonb_array_elements(record->'deductions'->'sviSales')->>'litres')::real as litres, r.date::date FROM public.day_book_records r WHERE r.user_id = auth.uid()
        ) d
        WHERE d.account_id IS NOT NULL AND d.date >= previous_month_start AND d.date <= current_month_end
        GROUP BY d.account_id, d.date
    ),
    sales_comparison AS (
        SELECT
            ms.account_id,
            SUM(CASE WHEN ms.date BETWEEN previous_month_start AND previous_month_end THEN ms.total_litres ELSE 0 END)::real as prev_month_litres,
            SUM(CASE WHEN ms.date BETWEEN current_month_start AND current_month_end THEN ms.total_litres ELSE 0 END)::real as curr_month_litres
        FROM monthly_sales ms
        GROUP BY ms.account_id
    )
    SELECT
        sc.account_id,
        a.name as account_name,
        a.type as account_type, -- Correctly returns account_type
        sc.prev_month_litres as previous_month_litres,
        sc.curr_month_litres as current_month_litres,
        CASE
            WHEN sc.prev_month_litres > 0 THEN ((sc.curr_month_litres - sc.prev_month_litres) / sc.prev_month_litres * 100)::real
            WHEN sc.curr_month_litres > 0 THEN 100.0::real
            ELSE 0.0::real
        END as percentage_change
    FROM sales_comparison sc
    JOIN public.accounts a ON sc.account_id = a.id
    WHERE a.user_id = auth.uid() AND (sc.prev_month_litres > 0 AND ABS(((sc.curr_month_litres - sc.prev_month_litres) / sc.prev_month_litres * 100)) >= percentage_threshold);
END;
$$;

-- Function 6: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(
    account_id uuid,
    account_name text,
    account_type public.account_type,
    total_outstanding numeric,
    days_0_30 numeric,
    days_31_60 numeric,
    days_61_90 numeric,
    days_over_90 numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH all_debits AS (
        SELECT b.account_id, b.date::date, b.amount FROM public.balance_entries b WHERE b.type = 'debit' AND b.user_id = auth.uid()
        UNION ALL
        SELECT (jsonb_array_elements(r.record->'deductions'->'creditSales')->>'accountId')::uuid, r.date::date, (jsonb_array_elements(r.record->'deductions'->'creditSales')->>'amount')::numeric FROM public.day_book_records r WHERE r.user_id = auth.uid() AND jsonb_typeof(r.record->'deductions'->'creditSales') = 'array'
        UNION ALL
        SELECT (jsonb_array_elements(r.record->'deductions'->'sales0332')->>'accountId')::uuid, r.date::date, (jsonb_array_elements(r.record->'deductions'->'sales0332')->>'amount')::numeric FROM public.day_book_records r WHERE r.user_id = auth.uid() AND jsonb_typeof(r.record->'deductions'->'sales0332') = 'array'
        UNION ALL
        SELECT (jsonb_array_elements(r.record->'deductions'->'sviSales')->>'accountId')::uuid, r.date::date, (jsonb_array_elements(r.record->'deductions'->'sviSales')->>'amount')::numeric FROM public.day_book_records r WHERE r.user_id = auth.uid() AND jsonb_typeof(r.record->'deductions'->'sviSales') = 'array'
        UNION ALL
        SELECT (jsonb_array_elements(r.record->'cashTransactions')->>'accountId')::uuid, r.date::date, (jsonb_array_elements(r.record->'cashTransactions')->>'amount')::numeric FROM public.day_book_records r WHERE r.user_id = auth.uid() AND jsonb_typeof(r.record->'cashTransactions') = 'array' AND jsonb_array_elements(r.record->'cashTransactions')->>'type' = 'out'
    ),
    all_credits AS (
        SELECT p.account_id, p.date::date, p.amount FROM public.payments_received p WHERE p.user_id = auth.uid()
        UNION ALL
        SELECT b.account_id, b.date::date, b.amount FROM public.balance_entries b WHERE b.type = 'credit' AND b.user_id = auth.uid()
        UNION ALL
        SELECT (jsonb_array_elements(r.record->'cashTransactions')->>'accountId')::uuid, r.date::date, (jsonb_array_elements(r.record->'cashTransactions')->>'amount')::numeric FROM public.day_book_records r WHERE r.user_id = auth.uid() AND jsonb_typeof(r.record->'cashTransactions') = 'array' AND jsonb_array_elements(r.record->'cashTransactions')->>'type' = 'in'
    ),
    account_credits AS (SELECT account_id, SUM(amount) as total_credit FROM all_credits GROUP BY account_id),
    outstanding_debits AS (
        SELECT
            d.account_id,
            d.date,
            d.amount,
            d.amount - COALESCE(SUM(c.amount) OVER (PARTITION BY d.account_id ORDER BY c.date, d.date), 0) as remaining_amount
        FROM all_debits d
        LEFT JOIN all_credits c ON d.account_id = c.account_id AND c.date >= d.date
        GROUP BY d.account_id, d.date, d.amount
    ),
    aged_debits AS (
        SELECT
            od.account_id,
            od.date,
            od.remaining_amount,
            (now()::date - od.date) as age
        FROM outstanding_debits od
        WHERE od.remaining_amount > 0
    )
    SELECT
        a.id as account_id,
        a.name as account_name,
        a.type as account_type,
        COALESCE(SUM(ad.remaining_amount), 0)::numeric as total_outstanding,
        COALESCE(SUM(CASE WHEN ad.age <= 30 THEN ad.remaining_amount ELSE 0 END), 0)::numeric as days_0_30,
        COALESCE(SUM(CASE WHEN ad.age > 30 AND ad.age <= 60 THEN ad.remaining_amount ELSE 0 END), 0)::numeric as days_31_60,
        COALESCE(SUM(CASE WHEN ad.age > 60 AND ad.age <= 90 THEN ad.remaining_amount ELSE 0 END), 0)::numeric as days_61_90,
        COALESCE(SUM(CASE WHEN ad.age > 90 THEN ad.remaining_amount ELSE 0 END), 0)::numeric as days_over_90
    FROM public.accounts a
    LEFT JOIN aged_debits ad ON a.id = ad.account_id
    WHERE a.user_id = auth.uid()
    GROUP BY a.id, a.name, a.type
    HAVING COALESCE(SUM(ad.remaining_amount), 0) > 0
    ORDER BY total_outstanding DESC;
END;
$$;

-- Function 7: get_records_for_carry_forward
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

    RETURN QUERY
    SELECT r.record
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND (
        (last_settled_date IS NOT NULL AND r.date::date > last_settled_date AND r.date::date < p_target_date)
        OR
        (last_settled_date IS NULL AND r.date::date < p_target_date)
      )
    ORDER BY r.date;
END;
$$;

-- Function 8: bulk_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

        IF (account_record->>'openingBalance')::numeric <> 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                NOW()::date,
                'Opening Balance',
                'debit',
                (account_record->>'openingBalance')::numeric
            );
        END IF;
    END LOOP;
END;
$$;

-- Function 9: bulk_add_payments_and_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    payment_record jsonb;
    target_account_id uuid;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        SELECT id INTO target_account_id
        FROM public.accounts
        WHERE user_id = auth.uid() AND name = payment_record->>'account_name';

        IF target_account_id IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment_record->>'account_name', 'factory')
            RETURNING id INTO target_account_id;
        END IF;

        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number)
        VALUES (
            p_date,
            auth.uid(),
            target_account_id,
            (payment_record->>'amount')::numeric,
            payment_record->>'description',
            payment_record->>'receipt_number'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
