-- DO NOT APPLY THIS SCRIPT IF YOU HAVE CUSTOMIZATIONS IN YOUR FUNCTIONS NOT CAPTURED HERE.
-- This script will DROP and RECREATE all application-specific functions to ensure security settings are correct.

-- ========= SAFE DELETION OF ALL FUNCTIONS =========
DROP FUNCTION IF EXISTS public.delete_all_user_data();
DROP FUNCTION IF EXISTS public.delete_records_for_date(text);
DROP FUNCTION IF EXISTS public.delete_transaction(text);
DROP FUNCTION IF EXISTS public.get_monthly_fuel_sales();
DROP FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real);
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();
DROP FUNCTION IF EXISTS public.get_records_for_carry_forward(date);
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);

-- ========= RE-CREATION OF ALL FUNCTIONS WITH SECURITY INVOKER =========

-- Function: delete_all_user_data
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER -- Ensures the function runs with the permissions of the user who calls it
AS $$
BEGIN
  -- This will delete records associated with the currently authenticated user
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.stock_orders WHERE user_id = auth.uid();
  -- Balance entries and accounts are linked and will cascade or should be deleted
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
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
  DELETE FROM public.payments_received WHERE date = record_date AND user_id = auth.uid();
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
  table_name TEXT;
  record_id TEXT;
BEGIN
  -- Extract table identifier and ID from the combined transaction ID
  table_name := split_part(p_transaction_id, ':', 1);
  record_id := split_part(p_transaction_id, ':', 2);

  IF table_name = 'be' THEN
    DELETE FROM public.balance_entries WHERE id = record_id AND user_id = auth.uid();
  ELSIF table_name = 'pr' THEN
    DELETE FROM public.payments_received WHERE id = record_id AND user_id = auth.uid();
  ELSE
    -- For day book transactions, we need to fetch, modify, and update the JSON
    -- This part is complex and safer to handle in application logic by re-saving the daybook record.
    -- For now, we raise a notice that it's not handled here.
    RAISE NOTICE 'Deletion for day book transactions must be handled by updating the day book record JSON.';
  END IF;
END;
$$;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;

-- Function: get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres double precision, total_diesel_litres double precision)
LANGUAGE sql
SECURITY INVOKER
AS $$
SELECT
  date_trunc('month', r.date::date)::date as month_start,
  sum(
    (
      SELECT sum(
        GREATEST(0, (m ->> 'closingReading')::double precision - (m ->> 'openingReading')::double precision)
      )
      FROM jsonb_array_elements(r.record->'machines'->'petrol') as m
    )
  ) as total_petrol_litres,
  sum(
    (
      SELECT sum(
        GREATEST(0, (m ->> 'closingReading')::double precision - (m ->> 'openingReading')::double precision)
      )
      FROM jsonb_array_elements(r.record->'machines'->'diesel') as m
    )
  ) as total_diesel_litres
FROM public.day_book_records r
WHERE r.user_id = auth.uid() AND r.date::date >= date_trunc('month', now() - interval '11 months')::date
GROUP BY month_start
ORDER BY month_start ASC;
$$;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;

-- Function: get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres double precision, current_month_litres double precision, percentage_change real)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH monthly_sales AS (
  SELECT
    d.date::date,
    (sale->>'accountId')::uuid as account_id,
    (sale->>'litres')::double precision as litres
  FROM public.day_book_records d,
       jsonb_array_elements(d.record->'deductions'->'creditSales') as sale
  WHERE d.user_id = auth.uid()
  UNION ALL
  SELECT
    d.date::date,
    (sale->>'accountId')::uuid as account_id,
    (sale->>'litres')::double precision as litres
  FROM public.day_book_records d,
       jsonb_array_elements(d.record->'deductions'->'sales0332') as sale
  WHERE d.user_id = auth.uid()
),
aggregated_sales AS (
  SELECT
    date_trunc('month', ms.date)::date as month,
    ms.account_id,
    sum(ms.litres) as total_litres
  FROM monthly_sales ms
  WHERE ms.account_id IS NOT NULL
  GROUP BY 1, 2
),
current_month_sales AS (
  SELECT account_id, total_litres FROM aggregated_sales WHERE month = current_month_start
),
previous_month_sales AS (
  SELECT account_id, total_litres FROM aggregated_sales WHERE month = (current_month_start - interval '1 month')::date
)
SELECT
  a.id as account_id,
  a.name as account_name,
  a.type as account_type,
  coalesce(pms.total_litres, 0)::double precision as previous_month_litres,
  coalesce(cms.total_litres, 0)::double precision as current_month_litres,
  (CASE
    WHEN coalesce(pms.total_litres, 0) = 0 THEN
      CASE WHEN coalesce(cms.total_litres, 0) > 0 THEN 100.0 ELSE 0.0 END
    ELSE
      ((coalesce(cms.total_litres, 0) - pms.total_litres) / pms.total_litres) * 100.0
  END)::real as percentage_change
FROM public.accounts a
LEFT JOIN current_month_sales cms ON a.id = cms.account_id
LEFT JOIN previous_month_sales pms ON a.id = pms.account_id
WHERE
  a.user_id = auth.uid() AND
  (
    (coalesce(pms.total_litres, 0) > 0 AND abs(((coalesce(cms.total_litres, 0) - pms.total_litres) / pms.total_litres) * 100.0) >= percentage_threshold)
    OR
    (coalesce(pms.total_litres, 0) = 0 AND coalesce(cms.total_litres, 0) > 0)
  );
$$;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;

-- Function: get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH all_transactions AS (
    -- Debits from day_book_records
    SELECT
        (sale->>'accountId')::uuid as account_id,
        d.date::date as tx_date,
        -(sale->>'amount')::numeric as amount
    FROM public.day_book_records d,
         jsonb_array_elements(d.record->'deductions'->'creditSales') as sale
    WHERE d.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    UNION ALL
    SELECT
        (sale->>'accountId')::uuid as account_id,
        d.date::date as tx_date,
        -(sale->>'amount')::numeric as amount
    FROM public.day_book_records d,
         jsonb_array_elements(d.record->'deductions'->'sales0332') as sale
    WHERE d.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    UNION ALL
    -- Credits from payments_received
    SELECT
        p.account_id,
        p.date::date as tx_date,
        p.amount::numeric
    FROM public.payments_received p
    WHERE p.user_id = auth.uid()
    UNION ALL
    -- Balance Entries
    SELECT
        b.account_id,
        b.date::date as tx_date,
        CASE WHEN b.type = 'credit' THEN b.amount::numeric ELSE -b.amount::numeric END
    FROM public.balance_entries b
    WHERE b.user_id = auth.uid()
),
aged_debits AS (
    SELECT
        account_id,
        tx_date,
        -amount as debit_amount,
        now()::date - tx_date as age
    FROM all_transactions
    WHERE amount < 0
),
credits AS (
    SELECT
        account_id,
        amount as credit_amount
    FROM all_transactions
    WHERE amount > 0
),
account_balances AS (
    SELECT
        account_id,
        sum(amount) as balance
    FROM all_transactions
    GROUP BY account_id
)
SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    -ab.balance as total_outstanding,
    sum(CASE WHEN ad.age <= 30 THEN ad.debit_amount ELSE 0 END) as days_0_30,
    sum(CASE WHEN ad.age > 30 AND ad.age <= 60 THEN ad.debit_amount ELSE 0 END) as days_31_60,
    sum(CASE WHEN ad.age > 60 AND ad.age <= 90 THEN ad.debit_amount ELSE 0 END) as days_61_90,
    sum(CASE WHEN ad.age > 90 THEN ad.debit_amount ELSE 0 END) as days_over_90
FROM public.accounts a
JOIN account_balances ab ON a.id = ab.account_id
LEFT JOIN aged_debits ad ON a.id = ad.account_id
WHERE a.user_id = auth.uid() AND ab.balance < 0
GROUP BY a.id, a.name, a.type, ab.balance
ORDER BY a.name;
$$;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;

-- Function: get_records_for_carry_forward
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(date text, record jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    last_settled_date date;
BEGIN
    -- Find the most recent date ON OR BEFORE the target date where cash was collected
    SELECT MAX(r.date::date)
    INTO last_settled_date
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date::date <= p_target_date
      AND (r.record->>'cashCollected')::boolean = true;

    -- If no settled date is found, start from the very first record
    IF last_settled_date IS NULL THEN
        SELECT MIN(r.date::date)
        INTO last_settled_date
        FROM public.day_book_records r
        WHERE r.user_id = auth.uid();
    END IF;

    -- Return all records from the last settled date up to (but not including) the target date
    RETURN QUERY
    SELECT r.date, r.record
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date::date >= COALESCE(last_settled_date, '1970-01-01')
      AND r.date::date < p_target_date
    ORDER BY r.date::date ASC;
END;
$$;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;

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
        -- Insert the new account
        INSERT INTO public.accounts (user_id, name, type, contact, address)
        VALUES (
            auth.uid(),
            account_record->>'name',
            (account_record->>'type')::public.account_type,
            account_record->>'contact',
            account_record->>'address'
        )
        RETURNING id INTO new_account_id;

        -- Insert the opening balance entry
        IF (account_record->>'openingBalance')::numeric != 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                NOW()::date,
                'Opening Balance',
                'debit', -- Assuming opening balance is a debit
                (account_record->>'openingBalance')::numeric
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
    account_id_var uuid;
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        -- Check if account exists, otherwise create it
        SELECT id INTO account_id_var FROM public.accounts WHERE name = payment_record->>'account_name' AND user_id = auth.uid();

        IF account_id_var IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (auth.uid(), payment_record->>'account_name', 'factory') -- Defaulting to 'factory'
            RETURNING id INTO account_id_var;
        END IF;
        
        -- Insert the payment, checking for unique receipt number
        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number, payment_method)
        VALUES (
            p_date,
            auth.uid(),
            account_id_var,
            (payment_record->>'amount')::numeric,
            payment_record->>'description',
            payment_record->>'receipt_number',
            'Paytm' -- Defaulting to 'Paytm' for this bulk upload
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;
