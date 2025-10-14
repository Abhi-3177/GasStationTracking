-- Secure get_monthly_fuel_sales
CREATE OR REPLACE FUNCTION public.get_monthly_fuel_sales()
RETURNS TABLE(month_start text, total_petrol_litres numeric, total_diesel_litres numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_sales AS (
    SELECT
      date_trunc('month', r.date)::date AS month_start,
      (r.record -> 'machines' ->> 'petrol')::jsonb AS petrol_machines,
      (r.record -> 'machines' ->> 'diesel')::jsonb AS diesel_machines
    FROM day_book_records r
    WHERE r.user_id = auth.uid()
      AND r.date >= date_trunc('month', now() - interval '11 months')::date
  )
  SELECT
    ms.month_start::text,
    sum(
      (
        SELECT COALESCE(sum((m ->> 'closingReading')::numeric - (m ->> 'openingReading')::numeric), 0)
        FROM jsonb_array_elements(ms.petrol_machines) m
      )
    )::numeric AS total_petrol_litres,
    sum(
      (
        SELECT COALESCE(sum((m ->> 'closingReading')::numeric - (m ->> 'openingReading')::numeric), 0)
        FROM jsonb_array_elements(ms.diesel_machines) m
      )
    )::numeric AS total_diesel_litres
  FROM monthly_sales ms
  GROUP BY ms.month_start
  ORDER BY ms.month_start DESC;
END;
$$;

-- Secure get_account_sales_fluctuation
CREATE OR REPLACE FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
RETURNS TABLE(account_id uuid, account_name text, account_type text, previous_month_litres numeric, current_month_litres numeric, percentage_change real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_month_start date := current_month_start - interval '1 month';
  previous_month_end date := current_month_start - interval '1 day';
  current_month_end date := current_month_start + interval '1 month' - interval '1 day';
BEGIN
  RETURN QUERY
  WITH all_sales AS (
      SELECT r.date, (jsonb_array_elements(r.record -> 'deductions' -> 'creditSales') ->> 'accountId')::uuid AS acc_id, (jsonb_array_elements(r.record -> 'deductions' -> 'creditSales') ->> 'litres')::numeric AS litres FROM day_book_records r WHERE r.user_id = auth.uid() AND r.record -> 'deductions' ->> 'creditSales' IS NOT NULL
      UNION ALL
      SELECT r.date, (jsonb_array_elements(r.record -> 'deductions' -> 'sales0332') ->> 'accountId')::uuid, (jsonb_array_elements(r.record -> 'deductions' -> 'sales0332') ->> 'litres')::numeric FROM day_book_records r WHERE r.user_id = auth.uid() AND r.record -> 'deductions' ->> 'sales0332' IS NOT NULL
      UNION ALL
      SELECT r.date, (jsonb_array_elements(r.record -> 'deductions' -> 'sviSales') ->> 'accountId')::uuid, (jsonb_array_elements(r.record -> 'deductions' -> 'sviSales') ->> 'litres')::numeric FROM day_book_records r WHERE r.user_id = auth.uid() AND r.record -> 'deductions' ->> 'sviSales' IS NOT NULL
  ),
  monthly_totals AS (
      SELECT
          s.acc_id,
          sum(CASE WHEN s.date BETWEEN previous_month_start AND previous_month_end THEN s.litres ELSE 0 END) AS previous_month_litres,
          sum(CASE WHEN s.date BETWEEN current_month_start AND current_month_end THEN s.litres ELSE 0 END) AS current_month_litres
      FROM all_sales s
      WHERE s.acc_id IS NOT NULL
      GROUP BY s.acc_id
  )
  SELECT
      a.id,
      a.name,
      a.type,
      mt.previous_month_litres,
      mt.current_month_litres,
      CASE
          WHEN mt.previous_month_litres > 0 THEN
              round((((mt.current_month_litres - mt.previous_month_litres) / mt.previous_month_litres) * 100)::numeric, 2)::real
          ELSE
              CASE WHEN mt.current_month_litres > 0 THEN 100.0 ELSE 0.0 END
      END AS percentage_change
  FROM monthly_totals mt
  JOIN accounts a ON mt.acc_id = a.id
  WHERE
      mt.previous_month_litres > 0 AND
      abs((((mt.current_month_litres - mt.previous_month_litres) / mt.previous_month_litres) * 100)) >= percentage_threshold;
END;
$$;

-- Secure get_aged_debtors_report
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(account_id uuid, account_name text, account_type text, total_outstanding numeric, days_0_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    SELECT b.account_id AS acc_id, b.date, b.amount, b.type FROM balance_entries b WHERE b.user_id = auth.uid()
    UNION ALL
    SELECT p.account_id, p.date, p.amount, 'credit'::text FROM payments_received p WHERE p.user_id = auth.uid()
    UNION ALL
    SELECT (sale ->> 'accountId')::uuid, r.date, (sale ->> 'amount')::numeric, 'debit'::text FROM day_book_records r, jsonb_array_elements(r.record -> 'deductions' -> 'creditSales') sale WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
    UNION ALL
    SELECT (sale ->> 'accountId')::uuid, r.date, (sale ->> 'amount')::numeric, 'debit'::text FROM day_book_records r, jsonb_array_elements(r.record -> 'deductions' -> 'sales0332') sale WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
    UNION ALL
    SELECT (sale ->> 'accountId')::uuid, r.date, (sale ->> 'amount')::numeric, 'debit'::text FROM day_book_records r, jsonb_array_elements(r.record -> 'deductions' -> 'sviSales') sale WHERE r.user_id = auth.uid() AND sale ->> 'accountId' IS NOT NULL
    UNION ALL
    SELECT (trans ->> 'accountId')::uuid, r.date, (trans ->> 'amount')::numeric, CASE WHEN trans ->> 'type' = 'in' THEN 'credit' ELSE 'debit' END FROM day_book_records r, jsonb_array_elements(r.record -> 'cashTransactions') trans WHERE r.user_id = auth.uid() AND trans ->> 'accountId' IS NOT NULL
  ),
  aged_debits AS (
    SELECT
      t.acc_id,
      t.amount,
      current_date - t.date::date AS age
    FROM all_transactions t
    WHERE t.type = 'debit'
  ),
  credit_totals AS (
    SELECT
      t.acc_id,
      sum(t.amount) as total_credit
    FROM all_transactions t
    WHERE t.type = 'credit'
    GROUP BY t.acc_id
  ),
  settled_debits AS (
    SELECT
      ad.acc_id,
      ad.age,
      ad.amount,
      COALESCE(ct.total_credit, 0) as total_credit,
      sum(ad.amount) OVER (PARTITION BY ad.acc_id ORDER BY ad.age DESC) as running_debit
    FROM aged_debits ad
    LEFT JOIN credit_totals ct ON ad.acc_id = ct.acc_id
  ),
  unsettled_balances AS (
    SELECT
      sd.acc_id,
      sd.age,
      CASE
        WHEN sd.running_debit <= sd.total_credit THEN 0
        ELSE LEAST(sd.amount, sd.running_debit - sd.total_credit)
      END as unsettled_amount
    FROM settled_debits sd
  )
  SELECT
    a.id,
    a.name,
    a.type,
    sum(ub.unsettled_amount)::numeric as total_outstanding,
    sum(CASE WHEN ub.age <= 30 THEN ub.unsettled_amount ELSE 0 END)::numeric as days_0_30,
    sum(CASE WHEN ub.age > 30 AND ub.age <= 60 THEN ub.unsettled_amount ELSE 0 END)::numeric as days_31_60,
    sum(CASE WHEN ub.age > 60 AND ub.age <= 90 THEN ub.unsettled_amount ELSE 0 END)::numeric as days_61_90,
    sum(CASE WHEN ub.age > 90 THEN ub.unsettled_amount ELSE 0 END)::numeric as days_over_90
  FROM unsettled_balances ub
  JOIN accounts a ON ub.acc_id = a.id
  WHERE ub.unsettled_amount > 0
  GROUP BY a.id, a.name, a.type
  ORDER BY total_outstanding DESC;
END;
$$;
