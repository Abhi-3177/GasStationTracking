-- Step 1: Create the custom account_type if it doesn't exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE public.account_type AS ENUM ('factory', 'transporter');
    END IF;
END$$;

-- Step 2: Safely drop all existing custom functions to ensure a clean slate.
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);

-- Step 3: Re-create all functions with the correct definitions and security settings.

-- Function: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    -- This function deletes all data associated with the currently authenticated user.
    DELETE FROM public.day_book_records WHERE user_id = auth.uid();
    DELETE FROM public.daily_records WHERE user_id = auth.uid();
    DELETE FROM public.payments_received WHERE user_id = auth.uid();
    DELETE FROM public.balance_entries WHERE user_id = auth.uid();
    DELETE FROM public.stock_orders WHERE user_id = auth.uid();
    DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$;

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

-- Function: delete_transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    parts text[];
    transaction_type text;
    record_id text;
BEGIN
    parts := string_to_array(p_transaction_id, ':');
    transaction_type := parts[1];
    record_id := parts[2];

    IF transaction_type = 'be' THEN
        DELETE FROM public.balance_entries WHERE id = record_id::uuid AND user_id = auth.uid();
    ELSIF transaction_type = 'pr' THEN
        DELETE FROM public.payments_received WHERE id = record_id::uuid AND user_id = auth.uid();
    ELSE
        -- For transactions embedded in day_book_records JSON
        -- This requires a more complex update logic which is handled client-side by re-saving the record.
        -- This function primarily targets standalone table entries.
    END IF;
END;
$$;

-- Function: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        date_trunc('month', date::date)::date as month_start,
        sum((jsonb_path_query_first(record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision - (jsonb_path_query_first(record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision) as total_petrol_litres,
        sum((jsonb_path_query_first(record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision - (jsonb_path_query_first(record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision) as total_diesel_litres
    FROM public.day_book_records
    WHERE user_id = auth.uid() AND date::date >= date_trunc('month', now()) - interval '11 months'
    GROUP BY month_start
    ORDER BY month_start ASC;
$$;

-- Function: get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, previous_month_litres double precision, current_month_litres double precision, percentage_change real)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH monthly_sales AS (
    SELECT
        dbr.user_id,
        date_trunc('month', dbr.date::date)::date as month,
        (sale ->> 'accountId')::uuid as account_id,
        sum((sale ->> 'litres')::double precision) as total_litres
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') as sale
    WHERE dbr.user_id = auth.uid()
    GROUP BY 1, 2, 3
),
current_month_sales AS (
    SELECT account_id, total_litres FROM monthly_sales WHERE month = current_month_start
),
previous_month_sales AS (
    SELECT account_id, total_litres FROM monthly_sales WHERE month = (current_month_start - interval '1 month')::date
)
SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    coalesce(pms.total_litres, 0) as previous_month_litres,
    coalesce(cms.total_litres, 0) as current_month_litres,
    (CASE
        WHEN coalesce(pms.total_litres, 0) = 0 THEN (CASE WHEN coalesce(cms.total_litres, 0) > 0 THEN 100.0 ELSE 0.0 END)
        ELSE ((coalesce(cms.total_litres, 0) - pms.total_litres) / pms.total_litres) * 100.0
    END)::real as percentage_change
FROM public.accounts a
LEFT JOIN current_month_sales cms ON a.id = cms.account_id
LEFT JOIN previous_month_sales pms ON a.id = pms.account_id
WHERE a.user_id = auth.uid()
  AND (
    coalesce(pms.total_litres, 0) > 0 OR coalesce(cms.total_litres, 0) > 0
  )
  AND abs(
    (CASE
        WHEN coalesce(pms.total_litres, 0) = 0 THEN (CASE WHEN coalesce(cms.total_litres, 0) > 0 THEN 100.0 ELSE 0.0 END)
        ELSE ((coalesce(cms.total_litres, 0) - pms.total_litres) / pms.total_litres) * 100.0
    END)
  ) >= percentage_threshold;
$$;

-- Function: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH transactions AS (
    -- Debits from credit sales
    SELECT
        (sale ->> 'accountId')::uuid as account_id,
        dbr.date::date as tx_date,
        (sale ->> 'amount')::numeric as amount
    FROM public.day_book_records dbr, jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') as sale
    WHERE dbr.user_id = auth.uid()
    UNION ALL
    -- Credits from payments
    SELECT
        pr.account_id,
        pr.date::date as tx_date,
        -pr.amount::numeric as amount
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()
),
aged_debits AS (
    SELECT
        account_id,
        amount,
        current_date - tx_date as age
    FROM transactions
    WHERE amount > 0
),
credits AS (
    SELECT
        account_id,
        -amount as credit_amount
    FROM transactions
    WHERE amount < 0
),
account_credits AS (
    SELECT account_id, sum(credit_amount) as total_credit FROM credits GROUP BY 1
),
settled_debits AS (
    SELECT
        d.account_id,
        d.amount,
        d.age,
        GREATEST(0, d.amount - GREATEST(0, coalesce(ac.total_credit, 0) - sum(d.amount) OVER (PARTITION BY d.account_id ORDER BY d.age DESC))) as outstanding_amount
    FROM aged_debits d
    LEFT JOIN account_credits ac ON d.account_id = ac.account_id
)
SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    coalesce(sum(sd.outstanding_amount), 0) as total_outstanding,
    coalesce(sum(CASE WHEN sd.age <= 30 THEN sd.outstanding_amount ELSE 0 END), 0) as days_0_30,
    coalesce(sum(CASE WHEN sd.age > 30 AND sd.age <= 60 THEN sd.outstanding_amount ELSE 0 END), 0) as days_31_60,
    coalesce(sum(CASE WHEN sd.age > 60 AND sd.age <= 90 THEN sd.outstanding_amount ELSE 0 END), 0) as days_61_90,
    coalesce(sum(CASE WHEN sd.age > 90 THEN sd.outstanding_amount ELSE 0 END), 0) as days_over_90
FROM public.accounts a
LEFT JOIN settled_debits sd ON a.id = sd.account_id
WHERE a.user_id = auth.uid()
GROUP BY 1, 2, 3
HAVING coalesce(sum(sd.outstanding_amount), 0) > 0;
$$;

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
    -- Find the most recent date on or before the target date where cash was collected
    SELECT max(dbr.date::date)
    INTO last_settled_date
    FROM public.day_book_records dbr
    WHERE dbr.user_id = auth.uid()
      AND dbr.date::date <= p_target_date
      AND (dbr.record ->> 'cashCollected')::boolean = true;

    -- If no settled date is found, find the earliest record date for the user
    IF last_settled_date IS NULL THEN
        SELECT min(dbr.date::date)
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

-- Function: bulk_add_payments_and_create_accounts
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    payment_record jsonb;
    target_account_id uuid;
    account_name_text text;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        account_name_text := payment_record ->> 'account_name';
        
        -- Find existing account or create a new one
        SELECT id INTO target_account_id
        FROM public.accounts
        WHERE user_id = auth.uid() AND lower(name) = lower(account_name_text);

        IF target_account_id IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), account_name_text, 'factory')
            RETURNING id INTO target_account_id;
        END IF;

        -- Insert the payment, handling potential unique constraint violations
        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number, payment_method)
        VALUES (
            p_date,
            auth.uid(),
            target_account_id,
            (payment_record ->> 'amount')::numeric,
            payment_record ->> 'description',
            payment_record ->> 'receipt_number',
            'Paytm'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
