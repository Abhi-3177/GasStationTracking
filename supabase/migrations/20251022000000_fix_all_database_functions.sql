-- Drop all functions and types in a safe order, handling dependencies.
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, numeric);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, integer);
DROP TYPE IF EXISTS public.account_type CASCADE;

DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);


-- Re-create the custom ENUM type first.
CREATE TYPE public.account_type AS ENUM ('factory', 'transporter');

-- Re-create all functions with the correct 'SECURITY INVOKER' setting.

-- Function 1: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  DELETE FROM public.stock_reports WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;
ALTER FUNCTION public.delete_all_user_data() SET search_path = 'public';

-- Function 2: delete_records_for_date
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.payments_received WHERE date = record_date AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = 'public';

-- Function 3: delete_transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void AS $$
DECLARE
    parts text[];
    transaction_type text;
    record_date text;
    item_id text;
    day_book_record jsonb;
    updated_record jsonb;
BEGIN
    parts := string_to_array(p_transaction_id, ':');
    transaction_type := parts[1];
    
    IF transaction_type = 'be' THEN
        DELETE FROM public.balance_entries WHERE id = parts[2] AND user_id = auth.uid();
    ELSIF transaction_type = 'pr' THEN
        DELETE FROM public.payments_received WHERE id = parts[2] AND user_id = auth.uid();
    ELSE
        record_date := parts[2];
        item_id := parts[3];

        SELECT record INTO day_book_record FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();

        IF day_book_record IS NOT NULL THEN
            IF transaction_type = 'cs' THEN
                updated_record := jsonb_set(
                    day_book_record,
                    '{deductions,creditSales}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'creditSales') AS elem WHERE elem->>'id' <> item_id)
                );
            ELSIF transaction_type = 's0' THEN
                 updated_record := jsonb_set(
                    day_book_record,
                    '{deductions,sales0332}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sales0332') AS elem WHERE elem->>'id' <> item_id)
                );
            ELSIF transaction_type = 'sv' THEN
                 updated_record := jsonb_set(
                    day_book_record,
                    '{deductions,sviSales}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sviSales') AS elem WHERE elem->>'id' <> item_id)
                );
            ELSIF transaction_type LIKE 'ct_%' THEN
                 updated_record := jsonb_set(
                    day_book_record,
                    '{cashTransactions}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'cashTransactions') AS elem WHERE elem->>'id' <> item_id)
                );
            END IF;

            UPDATE public.day_book_records SET record = updated_record WHERE date = record_date AND user_id = auth.uid();
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(text) SET search_path = 'public';

-- Function 4: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres numeric, total_diesel_litres numeric) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_sales AS (
        SELECT
            date_trunc('month', r.date::date) AS month_start,
            (jsonb_path_query_first(r.record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::numeric -
            (jsonb_path_query_first(r.record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::numeric AS petrol_litres,
            (jsonb_path_query_first(r.record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::numeric -
            (jsonb_path_query_first(r.record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::numeric AS diesel_litres
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid() AND r.date::date >= date_trunc('month', now()) - interval '11 months'
    )
    SELECT
        ms.month_start::date,
        sum(ms.petrol_litres) AS total_petrol_litres,
        sum(ms.diesel_litres) AS total_diesel_litres
    FROM monthly_sales ms
    GROUP BY ms.month_start
    ORDER BY ms.month_start;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = 'public';

-- Function 5: get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, previous_month_litres numeric, current_month_litres numeric, percentage_change real) AS $$
BEGIN
    RETURN QUERY
    WITH sales_data AS (
        SELECT
            s.id,
            s.name,
            s.accountId AS account_id,
            dbr.date::date,
            s.litres
        FROM public.day_book_records dbr,
             jsonb_to_recordset(dbr.record->'deductions'->'creditSales') as s(id text, name text, accountId uuid, litres numeric)
        WHERE dbr.user_id = auth.uid()
    ),
    monthly_litres AS (
        SELECT
            sd.account_id,
            date_trunc('month', sd.date)::date as month,
            sum(sd.litres) as total_litres
        FROM sales_data sd
        WHERE sd.date >= current_month_start - interval '1 month' AND sd.date < current_month_start + interval '1 month'
        GROUP BY sd.account_id, month
    ),
    comparison AS (
        SELECT
            a.id as account_id,
            a.name as account_name,
            a.type as account_type,
            COALESCE((SELECT ml.total_litres FROM monthly_litres ml WHERE ml.account_id = a.id AND ml.month = (current_month_start - interval '1 month')), 0) as previous_month_litres,
            COALESCE((SELECT ml.total_litres FROM monthly_litres ml WHERE ml.account_id = a.id AND ml.month = current_month_start), 0) as current_month_litres
        FROM public.accounts a
        WHERE a.user_id = auth.uid()
    )
    SELECT
        c.account_id,
        c.account_name,
        c.account_type,
        c.previous_month_litres,
        c.current_month_litres,
        CASE
            WHEN c.previous_month_litres = 0 THEN
                CASE WHEN c.current_month_litres > 0 THEN 100.0 ELSE 0.0 END
            ELSE
                ((c.current_month_litres - c.previous_month_litres) / c.previous_month_litres) * 100.0
        END::real as percentage_change
    FROM comparison c
    WHERE
        (c.previous_month_litres > 0 OR c.current_month_litres > 0) AND
        ABS(
            CASE
                WHEN c.previous_month_litres = 0 THEN
                    CASE WHEN c.current_month_litres > 0 THEN 100.0 ELSE 0.0 END
                ELSE
                    ((c.current_month_litres - c.previous_month_litres) / c.previous_month_litres) * 100.0
            END
        ) >= percentage_threshold;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = 'public';


-- Function 6: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric) AS $$
BEGIN
    RETURN QUERY
    WITH account_balances AS (
        SELECT
            be.account_id,
            sum(CASE WHEN be.type = 'debit' THEN be.amount ELSE -be.amount END) as balance
        FROM public.balance_entries be
        WHERE be.user_id = auth.uid()
        GROUP BY be.account_id
    ),
    aged_debits AS (
        SELECT
            be.account_id,
            sum(CASE WHEN current_date - be.date::date <= 30 THEN be.amount ELSE 0 END) as days_0_30,
            sum(CASE WHEN current_date - be.date::date BETWEEN 31 AND 60 THEN be.amount ELSE 0 END) as days_31_60,
            sum(CASE WHEN current_date - be.date::date BETWEEN 61 AND 90 THEN be.amount ELSE 0 END) as days_61_90,
            sum(CASE WHEN current_date - be.date::date > 90 THEN be.amount ELSE 0 END) as days_over_90
        FROM public.balance_entries be
        WHERE be.type = 'debit' AND be.user_id = auth.uid()
        GROUP BY be.account_id
    )
    SELECT
        a.id as account_id,
        a.name as account_name,
        a.type as account_type,
        COALESCE(ab.balance, 0) as total_outstanding,
        COALESCE(ad.days_0_30, 0) as days_0_30,
        COALESCE(ad.days_31_60, 0) as days_31_60,
        COALESCE(ad.days_61_90, 0) as days_61_90,
        COALESCE(ad.days_over_90, 0) as days_over_90
    FROM public.accounts a
    JOIN account_balances ab ON a.id = ab.account_id
    LEFT JOIN aged_debits ad ON a.id = ad.account_id
    WHERE ab.balance > 0 AND a.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = 'public';

-- Function 7: bulk_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void AS $$
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
                current_date,
                'Opening Balance',
                'debit',
                (account_record->>'openingBalance')::numeric
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = 'public';

-- Function 8: bulk_add_payments_and_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void AS $$
DECLARE
    payment_record jsonb;
    target_account_id uuid;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        SELECT id INTO target_account_id FROM public.accounts 
        WHERE user_id = auth.uid() AND name = (payment_record->>'account_name');

        IF NOT FOUND THEN
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
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = 'public';

-- Function 9: get_records_for_carry_forward
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb) AS $$
BEGIN
    RETURN QUERY
    WITH last_settled AS (
        SELECT MAX(r.date) as last_settled_date
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid()
          AND (r.record->>'cashCollected')::boolean = true
          AND r.date::date < p_target_date
    )
    SELECT r.record
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date::date >= (SELECT last_settled_date FROM last_settled)
      AND r.date::date < p_target_date
    ORDER BY r.date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = 'public';
