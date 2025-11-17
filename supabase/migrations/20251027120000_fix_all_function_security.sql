-- =================================================================
-- MASTER SECURITY PATCH FOR ALL CUSTOM DATABASE FUNCTIONS
--
-- This script performs a full reset of all custom functions to fix
-- the persistent "SECURITY DEFINER" error and related warnings.
--
-- What it does:
-- 1. DROPS all existing custom functions to ensure a clean state.
-- 2. RE-CREATES all functions from scratch.
-- 3. ENFORCES `SECURITY INVOKER` on every function to ensure
--    they respect Row Level Security (RLS) policies.
-- 4. SETS a secure `search_path` for each function.
--
-- This is a safe operation that only affects function definitions,
-- not your data.
-- =================================================================

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


-- Step 2: Re-create all functions with correct security settings

-- Function: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- This function deletes all data associated with the currently authenticated user.
  -- It is designed to be called from the app's "Reset Data" feature.
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;

-- Function: delete_records_for_date
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
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = public;

-- Function: delete_transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    prefix text;
    real_id text;
BEGIN
    prefix := split_part(p_transaction_id, ':', 1);
    real_id := split_part(p_transaction_id, ':', 2);

    IF prefix = 'be' THEN
        DELETE FROM public.balance_entries WHERE id = real_id::uuid AND user_id = auth.uid();
    ELSIF prefix = 'pr' THEN
        DELETE FROM public.payments_received WHERE id = real_id::uuid AND user_id = auth.uid();
    ELSE
        -- For transactions stored in JSON, we can't delete them directly.
        -- The app logic should handle resaving the DayBookRecord without the transaction.
        -- This function will gracefully do nothing for JSON-based transaction IDs.
    END IF;
END;
$$;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;

-- Function: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    WITH monthly_sales AS (
        SELECT
            date_trunc('month', r.date::date) AS month_start,
            (jsonb_path_query_first(r.record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision -
            (jsonb_path_query_first(r.record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision AS petrol_litres,
            (jsonb_path_query_first(r.record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision -
            (jsonb_path_query_first(r.record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision AS diesel_litres
        FROM
            public.day_book_records r
        WHERE
            r.user_id = auth.uid()
            AND r.date::date >= date_trunc('month', now()) - interval '11 months'
    )
    SELECT
        s.month_start::date,
        sum(s.petrol_litres) AS total_petrol_litres,
        sum(s.diesel_litres) AS total_diesel_litres
    FROM
        monthly_sales s
    GROUP BY
        s.month_start
    ORDER BY
        s.month_start ASC;
END;
$$;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;

-- Function: get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres double precision, current_month_litres double precision, percentage_change real)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    previous_month_start date := current_month_start - interval '1 month';
    previous_month_end date := current_month_start - interval '1 day';
    current_month_end date := current_month_start + interval '1 month' - interval '1 day';
BEGIN
    RETURN QUERY
    WITH sales AS (
        SELECT
            sale ->> 'accountId' AS acc_id,
            (sale ->> 'litres')::double precision AS litres,
            r.date::date
        FROM
            public.day_book_records r,
            jsonb_array_elements(r.record -> 'deductions' -> 'creditSales') sale
        WHERE r.user_id = auth.uid()
        UNION ALL
        SELECT
            sale ->> 'accountId' AS acc_id,
            (sale ->> 'litres')::double precision AS litres,
            r.date::date
        FROM
            public.day_book_records r,
            jsonb_array_elements(r.record -> 'deductions' -> 'sales0332') sale
        WHERE r.user_id = auth.uid()
        UNION ALL
        SELECT
            sale ->> 'accountId' AS acc_id,
            (sale ->> 'litres')::double precision AS litres,
            r.date::date
        FROM
            public.day_book_records r,
            jsonb_array_elements(r.record -> 'deductions' -> 'sviSales') sale
        WHERE r.user_id = auth.uid()
    ),
    monthly_litres AS (
        SELECT
            s.acc_id::uuid,
            sum(CASE WHEN s.date >= current_month_start AND s.date <= current_month_end THEN s.litres ELSE 0 END) as current_month_litres,
            sum(CASE WHEN s.date >= previous_month_start AND s.date <= previous_month_end THEN s.litres ELSE 0 END) as previous_month_litres
        FROM sales s
        WHERE s.acc_id IS NOT NULL
        GROUP BY s.acc_id
    )
    SELECT
        a.id,
        a.name,
        a.type,
        ml.previous_month_litres,
        ml.current_month_litres,
        CASE
            WHEN ml.previous_month_litres > 0 THEN
                ((ml.current_month_litres - ml.previous_month_litres) / ml.previous_month_litres * 100)::real
            ELSE
                CASE WHEN ml.current_month_litres > 0 THEN 100.0::real ELSE 0.0::real END
        END AS percentage_change
    FROM monthly_litres ml
    JOIN public.accounts a ON ml.acc_id = a.id
    WHERE
        a.user_id = auth.uid() AND
        (ml.previous_month_litres > 0 OR ml.current_month_litres > 0) AND
        abs(
            CASE
                WHEN ml.previous_month_litres > 0 THEN
                    ((ml.current_month_litres - ml.previous_month_litres) / ml.previous_month_litres * 100)
                ELSE
                    CASE WHEN ml.current_month_litres > 0 THEN 100.0 ELSE 0.0 END
            END
        ) >= percentage_threshold;
END;
$$;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;

-- Function: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    WITH all_transactions AS (
        -- Debits from Day Book
        SELECT
            (sale ->> 'accountId')::uuid AS acc_id,
            r.date::date AS tx_date,
            (sale ->> 'amount')::numeric AS amount,
            'debit' AS type
        FROM public.day_book_records r, jsonb_array_elements(r.record->'deductions'->'creditSales') sale
        WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
        UNION ALL
        SELECT
            (sale ->> 'accountId')::uuid AS acc_id,
            r.date::date AS tx_date,
            (sale ->> 'amount')::numeric AS amount,
            'debit' AS type
        FROM public.day_book_records r, jsonb_array_elements(r.record->'deductions'->'sales0332') sale
        WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
        UNION ALL
        SELECT
            (sale ->> 'accountId')::uuid AS acc_id,
            r.date::date AS tx_date,
            (sale ->> 'amount')::numeric AS amount,
            'debit' AS type
        FROM public.day_book_records r, jsonb_array_elements(r.record->'deductions'->'sviSales') sale
        WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
        UNION ALL
        -- Credits from Payments Received
        SELECT
            pr.account_id AS acc_id,
            pr.date::date AS tx_date,
            pr.amount::numeric AS amount,
            'credit' AS type
        FROM public.payments_received pr
        WHERE pr.user_id = auth.uid()
    ),
    outstanding_debits AS (
        SELECT
            d.acc_id,
            d.tx_date,
            d.amount - COALESCE(SUM(c.amount), 0) AS remaining_debit
        FROM
            (SELECT * FROM all_transactions WHERE type = 'debit') d
        LEFT JOIN
            (SELECT * FROM all_transactions WHERE type = 'credit') c ON d.acc_id = c.acc_id AND c.tx_date >= d.tx_date
        GROUP BY d.acc_id, d.tx_date, d.amount
        HAVING d.amount - COALESCE(SUM(c.amount), 0) > 0
    )
    SELECT
        a.id,
        a.name,
        a.type,
        SUM(od.remaining_debit) AS total_outstanding,
        SUM(CASE WHEN current_date - od.tx_date <= 30 THEN od.remaining_debit ELSE 0 END) AS days_0_30,
        SUM(CASE WHEN current_date - od.tx_date > 30 AND current_date - od.tx_date <= 60 THEN od.remaining_debit ELSE 0 END) AS days_31_60,
        SUM(CASE WHEN current_date - od.tx_date > 60 AND current_date - od.tx_date <= 90 THEN od.remaining_debit ELSE 0 END) AS days_61_90,
        SUM(CASE WHEN current_date - od.tx_date > 90 THEN od.remaining_debit ELSE 0 END) AS days_over_90
    FROM outstanding_debits od
    JOIN public.accounts a ON od.acc_id = a.id
    WHERE a.user_id = auth.uid()
    GROUP BY a.id, a.name, a.type
    HAVING SUM(od.remaining_debit) > 0;
END;
$$;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;

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
            account_record ->> 'name',
            (account_record ->> 'type')::public.account_type,
            account_record ->> 'contact',
            account_record ->> 'address'
        )
        RETURNING id INTO new_account_id;

        IF (account_record ->> 'openingBalance')::numeric > 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                current_date,
                'Opening Balance',
                'debit',
                (account_record ->> 'openingBalance')::numeric
            );
        END IF;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = public;

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
        WHERE user_id = auth.uid() AND name = (payment_record ->> 'account_name');

        IF v_account_id IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment_record ->> 'account_name', 'factory')
            RETURNING id INTO v_account_id;
        END IF;

        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number)
        VALUES (
            p_date,
            auth.uid(),
            v_account_id,
            (payment_record ->> 'amount')::numeric,
            payment_record ->> 'description',
            payment_record ->> 'receipt_number'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;

-- Function: get_records_for_carry_forward
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
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
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;
