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


-- Step 2: Re-create all functions with the correct `SECURITY INVOKER` property.

-- Function: delete_all_user_data()
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- This function deletes all data associated with the currently authenticated user.
  -- It truncates all tables that have user-specific data.
  TRUNCATE TABLE public.day_book_records RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.daily_records RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.accounts RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.balance_entries RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.payments_received RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.stock_orders RESTART IDENTITY CASCADE;
END;
$$;

-- Function: delete_records_for_date(text)
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

-- Function: delete_transaction(text)
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  parts text[];
  transaction_type text;
  record_date date;
  internal_id text;
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
    record_date := parts[2]::date;
    internal_id := parts[3];

    SELECT record INTO day_book_record FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();

    IF day_book_record IS NOT NULL THEN
      updated_record := day_book_record;
      IF transaction_type = 'cs' THEN
        updated_record := jsonb_set(
          updated_record,
          '{deductions,creditSales}',
          (SELECT jsonb_agg(elem) FROM jsonb_array_elements(updated_record->'deductions'->'creditSales') AS elem WHERE elem->>'id' <> internal_id)
        );
      ELSIF transaction_type = 's0' THEN
         updated_record := jsonb_set(
          updated_record,
          '{deductions,sales0332}',
          (SELECT jsonb_agg(elem) FROM jsonb_array_elements(updated_record->'deductions'->'sales0332') AS elem WHERE elem->>'id' <> internal_id)
        );
      ELSIF transaction_type = 'sv' THEN
        updated_record := jsonb_set(
          updated_record,
          '{deductions,sviSales}',
          (SELECT jsonb_agg(elem) FROM jsonb_array_elements(updated_record->'deductions'->'sviSales') AS elem WHERE elem->>'id' <> internal_id)
        );
      ELSIF transaction_type = 'ct_in' OR transaction_type = 'ct_out' THEN
        updated_record := jsonb_set(
          updated_record,
          '{cashTransactions}',
          (SELECT jsonb_agg(elem) FROM jsonb_array_elements(updated_record->'cashTransactions') AS elem WHERE elem->>'id' <> internal_id)
        );
      END IF;

      UPDATE public.day_book_records
      SET record = updated_record
      WHERE date = record_date AND user_id = auth.uid();
    END IF;
  END IF;
END;
$$;

-- Function: get_monthly_fuel_sales()
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start date, total_petrol_litres numeric, total_diesel_litres numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_sales AS (
    SELECT
      date_trunc('month', r.date)::date AS month_start,
      (
        SELECT COALESCE(SUM((m->>'closingReading')::numeric - (m->>'openingReading')::numeric), 0)
        FROM jsonb_array_elements(r.record->'machines'->'petrol') AS m
      ) AS petrol_litres,
      (
        SELECT COALESCE(SUM((m->>'closingReading')::numeric - (m->>'openingReading')::numeric), 0)
        FROM jsonb_array_elements(r.record->'machines'->'diesel') AS m
      ) AS diesel_litres
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid() AND r.date >= date_trunc('month', now()) - interval '11 months'
  )
  SELECT
    ms.month_start,
    SUM(ms.petrol_litres) AS total_petrol_litres,
    SUM(ms.diesel_litres) AS total_diesel_litres
  FROM monthly_sales ms
  GROUP BY ms.month_start
  ORDER BY ms.month_start ASC;
END;
$$;

-- Function: get_account_sales_fluctuation(date, real)
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres numeric, current_month_litres numeric, percentage_change numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  previous_month_start date := current_month_start - interval '1 month';
  current_month_end date := current_month_start + interval '1 month' - interval '1 day';
  previous_month_end date := previous_month_start + interval '1 month' - interval '1 day';
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT
      (sale->>'accountId')::uuid AS acc_id,
      (sale->>'litres')::numeric AS litres,
      r.date
    FROM public.day_book_records r,
         jsonb_array_elements(
           COALESCE(r.record->'deductions'->'creditSales', '[]'::jsonb) ||
           COALESCE(r.record->'deductions'->'sales0332', '[]'::jsonb) ||
           COALESCE(r.record->'deductions'->'sviSales', '[]'::jsonb)
         ) AS sale
    WHERE r.user_id = auth.uid()
      AND (sale->>'accountId') IS NOT NULL
  ),
  monthly_litres AS (
    SELECT
      sd.acc_id,
      SUM(CASE WHEN sd.date BETWEEN current_month_start AND current_month_end THEN sd.litres ELSE 0 END) AS current_litres,
      SUM(CASE WHEN sd.date BETWEEN previous_month_start AND previous_month_end THEN sd.litres ELSE 0 END) AS previous_litres
    FROM sales_data sd
    GROUP BY sd.acc_id
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    ml.previous_litres AS previous_month_litres,
    ml.current_litres AS current_month_litres,
    CASE
      WHEN ml.previous_litres > 0 THEN
        ROUND(((ml.current_litres - ml.previous_litres) / ml.previous_litres) * 100.0, 2)
      ELSE
        CASE WHEN ml.current_litres > 0 THEN 100.0 ELSE 0.0 END
    END AS percentage_change
  FROM monthly_litres ml
  JOIN public.accounts a ON ml.acc_id = a.id
  WHERE a.user_id = auth.uid()
    AND (
      ml.previous_litres = 0 AND ml.current_litres > 0 OR
      ml.current_litres = 0 AND ml.previous_litres > 0 OR
      ABS(((ml.current_litres - ml.previous_litres) / NULLIF(ml.previous_litres, 0)) * 100.0) >= percentage_threshold
    );
END;
$$;

-- Function: get_aged_debtors_report()
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Debits from day book
    SELECT
      (sale->>'accountId')::uuid AS acc_id,
      r.date::date AS tx_date,
      -(sale->>'amount')::numeric AS amount
    FROM public.day_book_records r,
         jsonb_array_elements(
           COALESCE(r.record->'deductions'->'creditSales', '[]'::jsonb) ||
           COALESCE(r.record->'deductions'->'sales0332', '[]'::jsonb) ||
           COALESCE(r.record->'deductions'->'sviSales', '[]'::jsonb)
         ) AS sale
    WHERE r.user_id = auth.uid() AND (sale->>'accountId') IS NOT NULL
    UNION ALL
    -- Credits from payments received
    SELECT
      pr.account_id AS acc_id,
      pr.date::date AS tx_date,
      pr.amount
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()
  ),
  account_balances AS (
    SELECT
      acc_id,
      SUM(amount) AS balance
    FROM all_transactions
    GROUP BY acc_id
    HAVING SUM(amount) < 0
  ),
  aged_debits AS (
    SELECT
      at.acc_id,
      at.tx_date,
      -at.amount AS debit_amount,
      now()::date - at.tx_date::date AS age
    FROM all_transactions at
    WHERE at.amount < 0 AND at.acc_id IN (SELECT acc_id FROM account_balances)
  ),
  settled_debits AS (
    SELECT
      ad.acc_id,
      ad.tx_date,
      ad.debit_amount,
      ad.age,
      GREATEST(0, ad.debit_amount - COALESCE(SUM(cr.amount) OVER (PARTITION BY ad.acc_id ORDER BY cr.tx_date), 0)) AS remaining_debit
    FROM aged_debits ad
    LEFT JOIN (SELECT acc_id, tx_date, amount FROM all_transactions WHERE amount > 0) cr
      ON ad.acc_id = cr.acc_id AND cr.tx_date >= ad.tx_date
  ),
  final_aging AS (
    SELECT
      sd.acc_id,
      SUM(CASE WHEN sd.age <= 30 THEN sd.remaining_debit ELSE 0 END) AS days_0_30,
      SUM(CASE WHEN sd.age > 30 AND sd.age <= 60 THEN sd.remaining_debit ELSE 0 END) AS days_31_60,
      SUM(CASE WHEN sd.age > 60 AND sd.age <= 90 THEN sd.remaining_debit ELSE 0 END) AS days_61_90,
      SUM(CASE WHEN sd.age > 90 THEN sd.remaining_debit ELSE 0 END) AS days_over_90
    FROM settled_debits sd
    GROUP BY sd.acc_id
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    -ab.balance AS total_outstanding,
    COALESCE(fa.days_0_30, 0) AS days_0_30,
    COALESCE(fa.days_31_60, 0) AS days_31_60,
    COALESCE(fa.days_61_90, 0) AS days_61_90,
    COALESCE(fa.days_over_90, 0) AS days_over_90
  FROM account_balances ab
  JOIN public.accounts a ON ab.acc_id = a.id
  LEFT JOIN final_aging fa ON ab.acc_id = fa.acc_id
  WHERE a.user_id = auth.uid()
  ORDER BY a.name;
END;
$$;

-- Function: get_records_for_carry_forward(date)
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS TABLE(record jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

  -- If no settled date is found, find the earliest record date for the user.
  IF last_settled_date IS NULL THEN
    SELECT MIN(r.date)
    INTO last_settled_date
    FROM public.day_book_records r
    WHERE r.user_id = auth.uid() AND r.date <= p_target_date;
  END IF;

  -- Return all records from the last settled date up to (but not including) the target date.
  RETURN QUERY
  SELECT r.record
  FROM public.day_book_records r
  WHERE r.user_id = auth.uid()
    AND r.date >= COALESCE(last_settled_date, p_target_date) -- Use target date if no records exist
    AND r.date < p_target_date
  ORDER BY r.date ASC;
END;
$$;

-- Function: bulk_create_accounts(jsonb)
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
        current_date,
        'Opening Balance',
        'debit',
        (account_record->>'openingBalance')::numeric
      );
    END IF;
  END LOOP;
END;
$$;

-- Function: bulk_add_payments_and_create_accounts(date, jsonb)
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  payment_record jsonb;
  account_id_val uuid;
BEGIN
  FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
  LOOP
    -- Check if account exists
    SELECT id INTO account_id_val FROM public.accounts WHERE name = payment_record->>'account_name' AND user_id = auth.uid();

    -- If not, create it
    IF account_id_val IS NULL THEN
      INSERT INTO public.accounts (user_id, name, type)
      VALUES (auth.uid(), payment_record->>'account_name', 'factory')
      RETURNING id INTO account_id_val;
    END IF;

    -- Insert the payment, ignoring duplicates based on the unique constraint
    INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number)
    VALUES (
      p_date,
      auth.uid(),
      account_id_val,
      (payment_record->>'amount')::numeric,
      payment_record->>'description',
      payment_record->>'receipt_number'
    )
    ON CONFLICT (user_id, receipt_number) DO NOTHING;
  END LOOP;
END;
$$;
