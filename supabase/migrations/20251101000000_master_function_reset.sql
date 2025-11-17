-- Drop all existing custom functions to resolve conflicts and overloads
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, integer);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, numeric);
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);

-- Drop and recreate the custom type to ensure it's clean
DROP TYPE IF EXISTS public.account_type;
CREATE TYPE public.account_type AS ENUM ('factory', 'transporter');

-- Recreate all functions with correct, unambiguous signatures and security settings

/*
# [Function] delete_all_user_data()
Deletes all records associated with the currently authenticated user.

## Query Description: [This is a highly destructive operation that will permanently delete all day books, daily records, accounts, and other related data for the user executing this command. It is intended for a full application reset. BACKUP RECOMMENDED before use.]

## Metadata:
- Schema-Category: "Dangerous"
- Impact-Level: "High"
- Requires-Backup: true
- Reversible: false

## Security Implications:
- RLS Status: Enforced via the function's SECURITY INVOKER property.
- Policy Changes: No
- Auth Requirements: Must be called by an authenticated user.
*/
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  DELETE FROM public.stock_reports WHERE user_id = auth.uid();
END;
$$;

/*
# [Function] delete_records_for_date(record_date text)
Deletes all records for a specific date for the current user.

## Query Description: [Permanently deletes all Day Book and Daily Record entries for a single specified date. This is useful for correcting a single day's entry but is irreversible.]

## Metadata:
- Schema-Category: "Dangerous"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: false

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.day_book_records WHERE user_id = auth.uid() AND date = record_date;
  DELETE FROM public.daily_records WHERE user_id = auth.uid() AND date = record_date;
  DELETE FROM public.payments_received WHERE user_id = auth.uid() AND date = record_date;
END;
$$;

/*
# [Function] delete_transaction(p_transaction_id text)
Deletes a specific transaction based on its prefixed ID.

## Query Description: [Deletes a single transaction record from either balance_entries or payments_received. This is a targeted deletion and is irreversible.]

## Metadata:
- Schema-Category: "Data"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: false

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  id_type text;
  real_id uuid;
BEGIN
  id_type := split_part(p_transaction_id, ':', 1);
  real_id := (split_part(p_transaction_id, ':', 2))::uuid;

  IF id_type = 'be' THEN
    DELETE FROM public.balance_entries WHERE id = real_id AND user_id = auth.uid();
  ELSIF id_type = 'pr' THEN
    DELETE FROM public.payments_received WHERE id = real_id AND user_id = auth.uid();
  END IF;
END;
$$;

/*
# [Function] get_monthly_fuel_sales()
Aggregates total petrol and diesel sales for the last 12 months.

## Query Description: [Reads from day_book_records to calculate monthly fuel sales totals. This is a read-only operation.]

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH monthly_litres AS (
    SELECT
        date_trunc('month', date::date) AS month_start,
        (jsonb_path_query_first(record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision -
        (jsonb_path_query_first(record, '$.machines.petrol[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision AS petrol_litres,
        (jsonb_path_query_first(record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).closingReading') ->> 0)::double precision -
        (jsonb_path_query_first(record, '$.machines.diesel[*] ? (@.closingReading > @.openingReading).openingReading') ->> 0)::double precision AS diesel_litres
    FROM public.day_book_records
    WHERE user_id = auth.uid() AND date::date >= date_trunc('month', now()) - interval '11 months'
)
SELECT
    month_start::date,
    sum(petrol_litres) as total_petrol_litres,
    sum(diesel_litres) as total_diesel_litres
FROM monthly_litres
GROUP BY month_start
ORDER BY month_start;
$$;

/*
# [Function] get_account_sales_fluctuation(date, real)
Compares fuel purchase volumes for accounts between the current and previous month.

## Query Description: [Reads from day_book_records to analyze sales data. This is a read-only operation.]

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, previous_month_litres numeric, current_month_litres numeric, percentage_change real)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH sales_data AS (
    SELECT
        (sale ->> 'accountId')::uuid AS account_id,
        date_trunc('month', dbr.date::date) AS sale_month,
        sum((sale ->> 'litres')::numeric) AS total_litres
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') AS sale
    WHERE dbr.user_id = auth.uid()
      AND sale ->> 'accountId' IS NOT NULL
      AND dbr.date::date >= current_month_start - interval '1 month'
      AND dbr.date::date < current_month_start + interval '1 month'
    GROUP BY 1, 2
),
monthly_sales AS (
    SELECT
        account_id,
        sum(CASE WHEN sale_month = (current_month_start - interval '1 month') THEN total_litres ELSE 0 END) AS previous_month_litres,
        sum(CASE WHEN sale_month = current_month_start THEN total_litres ELSE 0 END) AS current_month_litres
    FROM sales_data
    GROUP BY account_id
)
SELECT
    ms.account_id,
    a.name::text AS account_name,
    a.type AS account_type,
    ms.previous_month_litres,
    ms.current_month_litres,
    CASE
        WHEN ms.previous_month_litres = 0 THEN 100.0
        ELSE ((ms.current_month_litres - ms.previous_month_litres) / ms.previous_month_litres) * 100.0
    END::real AS percentage_change
FROM monthly_sales ms
JOIN public.accounts a ON ms.account_id = a.id
WHERE 
    a.user_id = auth.uid() AND
    (ms.previous_month_litres > 0 OR ms.current_month_litres > 0) AND
    (
        ms.previous_month_litres = 0 OR
        abs(((ms.current_month_litres - ms.previous_month_litres) / ms.previous_month_litres) * 100.0) >= percentage_threshold
    );
$$;

/*
# [Function] get_aged_debtors_report()
Calculates outstanding credit balances grouped by age.

## Query Description: [Reads from multiple tables to calculate aged debt. Read-only.]

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type public.account_type, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH all_transactions AS (
  -- Debits from Day Book
  SELECT
    (sale ->> 'accountId')::uuid as account_id,
    dbr.date::date,
    (sale ->> 'amount')::numeric as amount
  FROM public.day_book_records dbr,
       jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') as sale
  WHERE dbr.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
  UNION ALL
  SELECT
    (sale ->> 'accountId')::uuid,
    dbr.date::date,
    (sale ->> 'amount')::numeric
  FROM public.day_book_records dbr,
       jsonb_array_elements(dbr.record -> 'deductions' -> 'sales0332') as sale
  WHERE dbr.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
  UNION ALL
  SELECT
    (sale ->> 'accountId')::uuid,
    dbr.date::date,
    (sale ->> 'amount')::numeric
  FROM public.day_book_records dbr,
       jsonb_array_elements(dbr.record -> 'deductions' -> 'sviSales') as sale
  WHERE dbr.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
  UNION ALL
  -- Debits from Balance Entries
  SELECT
    be.account_id,
    be.date::date,
    be.amount
  FROM public.balance_entries be
  WHERE be.user_id = auth.uid() AND be.type = 'debit'
),
credits AS (
  -- Credits from Payments Received
  SELECT
    pr.account_id,
    pr.date::date,
    -pr.amount as amount
  FROM public.payments_received pr
  WHERE pr.user_id = auth.uid()
  UNION ALL
  -- Credits from Balance Entries
  SELECT
    be.account_id,
    be.date::date,
    -be.amount
  FROM public.balance_entries be
  WHERE be.user_id = auth.uid() AND be.type = 'credit'
),
aged_debts AS (
  SELECT
    t.account_id,
    sum(t.amount) as total_outstanding,
    sum(CASE WHEN current_date - t.date <= 30 THEN t.amount ELSE 0 END) as days_0_30,
    sum(CASE WHEN current_date - t.date > 30 AND current_date - t.date <= 60 THEN t.amount ELSE 0 END) as days_31_60,
    sum(CASE WHEN current_date - t.date > 60 AND current_date - t.date <= 90 THEN t.amount ELSE 0 END) as days_61_90,
    sum(CASE WHEN current_date - t.date > 90 THEN t.amount ELSE 0 END) as days_over_90
  FROM (SELECT * FROM all_transactions UNION ALL SELECT * FROM credits) t
  GROUP BY t.account_id
)
SELECT
  a.id as account_id,
  a.name::text as account_name,
  a.type as account_type,
  ad.total_outstanding,
  ad.days_0_30,
  ad.days_31_60,
  ad.days_61_90,
  ad.days_over_90
FROM aged_debts ad
JOIN public.accounts a ON ad.account_id = a.id
WHERE ad.total_outstanding > 0.01 AND a.user_id = auth.uid();
$$;

/*
# [Function] bulk_create_accounts(jsonb)
Creates multiple accounts and their opening balances in a single transaction.

## Query Description: [Inserts new rows into the 'accounts' and 'balance_entries' tables. Safe for new data.]

## Metadata:
- Schema-Category: "Data"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: false

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
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
            account ->> 'name',
            (account ->> 'type')::public.account_type,
            account ->> 'contact',
            account ->> 'address'
        )
        RETURNING id INTO new_account_id;

        IF (account ->> 'openingBalance')::numeric != 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                current_date,
                'Opening Balance',
                CASE WHEN (account ->> 'openingBalance')::numeric > 0 THEN 'debit' ELSE 'credit' END,
                abs((account ->> 'openingBalance')::numeric)
            );
        END IF;
    END LOOP;
END;
$$;

/*
# [Function] bulk_add_payments_and_create_accounts(date, jsonb)
Adds multiple payments, creating new accounts if they don't exist.

## Query Description: [Inserts into 'payments_received' and potentially 'accounts'. Safe for new data.]

## Metadata:
- Schema-Category: "Data"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: false

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKOER
AS $$
DECLARE
    payment jsonb;
    account_id_var uuid;
BEGIN
    FOR payment IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        SELECT id INTO account_id_var FROM public.accounts 
        WHERE user_id = auth.uid() AND name = (payment ->> 'account_name');

        IF account_id_var IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment ->> 'account_name', 'factory')
            RETURNING id INTO account_id_var;
        END IF;

        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number)
        VALUES (
            p_date,
            auth.uid(),
            account_id_var,
            (payment ->> 'amount')::numeric,
            payment ->> 'description',
            payment ->> 'receipt_number'
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;

/*
# [Function] get_records_for_carry_forward(date)
Fetches the chain of day book records needed to calculate a carry-forward balance.

## Query Description: [Reads from day_book_records. Read-only.]

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Security Implications:
- RLS Status: Enforced via SECURITY INVOKER.
- Policy Changes: No
- Auth Requirements: Authenticated user.
*/
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH last_settled AS (
    SELECT date
    FROM public.day_book_records
    WHERE user_id = auth.uid()
      AND (record ->> 'cashCollected')::boolean = true
      AND date < p_target_date
    ORDER BY date DESC
    LIMIT 1
)
SELECT dbr.record
FROM public.day_book_records dbr
WHERE dbr.user_id = auth.uid()
  AND dbr.date >= (SELECT date FROM last_settled)
  AND dbr.date < p_target_date
ORDER BY dbr.date;
$$;
