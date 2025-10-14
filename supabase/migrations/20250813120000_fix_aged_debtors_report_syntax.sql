-- Drop the old, faulty function to ensure a clean state
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();

-- Recreate the function with the correct syntax
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE(
  account_id uuid,
  account_name text,
  account_type text,
  total_outstanding numeric,
  days_0_30 numeric,
  days_31_60 numeric,
  days_61_90 numeric,
  days_over_90 numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Balance Entries
    SELECT
      be.account_id,
      be.date::date,
      CASE WHEN be.type = 'debit' THEN be.amount ELSE -be.amount END as amount
    FROM public.balance_entries be
    WHERE be.user_id = auth.uid()

    UNION ALL

    -- Payments Received (Credits)
    SELECT
      pr.account_id,
      pr.date::date,
      -pr.amount as amount
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()

    UNION ALL

    -- Credit Sales from Day Book (Debits)
    SELECT
      (cs.value->>'accountId')::uuid,
      dbr.date::date,
      (cs.value->>'amount')::numeric as amount
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'creditSales') cs
    WHERE dbr.user_id = auth.uid()
      AND cs.value->>'accountId' IS NOT NULL

    UNION ALL

    -- 0332 Sales from Day Book (Debits)
    SELECT
      (s0.value->>'accountId')::uuid,
      dbr.date::date,
      (s0.value->>'amount')::numeric as amount
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sales0332') s0
    WHERE dbr.user_id = auth.uid()
      AND s0.value->>'accountId' IS NOT NULL

    UNION ALL

    -- SVI Sales from Day Book (Debits)
    SELECT
      (svi.value->>'accountId')::uuid,
      dbr.date::date,
      (svi.value->>'amount')::numeric as amount
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sviSales') svi
    WHERE dbr.user_id = auth.uid()
      AND svi.value->>'accountId' IS NOT NULL
      
    UNION ALL

    -- Cash Transactions from Day Book
    SELECT
      (ct.value->>'accountId')::uuid,
      dbr.date::date,
      CASE WHEN ct.value->>'type' = 'out' THEN (ct.value->>'amount')::numeric ELSE -(ct.value->>'amount')::numeric END as amount
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'cashTransactions') ct
    WHERE dbr.user_id = auth.uid()
      AND ct.value->>'accountId' IS NOT NULL
  ),
  account_balances AS (
    SELECT
      at.account_id,
      SUM(at.amount) as balance
    FROM all_transactions at
    GROUP BY at.account_id
    HAVING SUM(at.amount) > 0
  ),
  aged_debts AS (
    SELECT
      t.account_id,
      t.date,
      t.amount,
      (current_date - t.date) as age
    FROM all_transactions t
    JOIN account_balances ab ON t.account_id = ab.account_id
    WHERE t.amount > 0
  )
  SELECT
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    ab.balance as total_outstanding,
    SUM(CASE WHEN ad.age <= 30 THEN ad.amount ELSE 0 END) as days_0_30,
    SUM(CASE WHEN ad.age > 30 AND ad.age <= 60 THEN ad.amount ELSE 0 END) as days_31_60,
    SUM(CASE WHEN ad.age > 60 AND ad.age <= 90 THEN ad.amount ELSE 0 END) as days_61_90,
    SUM(CASE WHEN ad.age > 90 THEN ad.amount ELSE 0 END) as days_over_90
  FROM public.accounts a
  JOIN account_balances ab ON a.id = ab.account_id
  LEFT JOIN aged_debts ad ON a.id = ad.account_id
  WHERE a.user_id = auth.uid()
  GROUP BY a.id, a.name, a.type, ab.balance
  ORDER BY a.name;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
