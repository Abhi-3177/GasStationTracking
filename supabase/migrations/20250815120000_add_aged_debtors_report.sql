-- Drop the old function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS public.get_aged_outstanding_credit();

-- Create the new, powerful aged debtors report function
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
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Balance Entries
    SELECT
      be.account_id,
      be.date::date,
      CASE WHEN be.type = 'debit' THEN be.amount ELSE 0 END AS debit,
      CASE WHEN be.type = 'credit' THEN be.amount ELSE 0 END AS credit
    FROM public.balance_entries be
    WHERE be.user_id = auth.uid()

    UNION ALL

    -- Payments Received
    SELECT
      pr.account_id,
      pr.date::date,
      0 AS debit,
      pr.amount AS credit
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()

    UNION ALL

    -- Credit Sales from Day Book
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'creditSales') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL

    -- 0332 Sales from Day Book
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sales0332') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    
    UNION ALL

    -- SVI Sales from Day Book
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sviSales') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL

    -- Cash Transactions from Day Book
    SELECT
      (trans->>'accountId')::uuid,
      dbr.date::date,
      CASE WHEN trans->>'type' = 'out' THEN (trans->>'amount')::numeric ELSE 0 END AS debit,
      CASE WHEN trans->>'type' = 'in' THEN (trans->>'amount')::numeric ELSE 0 END AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'cashTransactions') trans
    WHERE dbr.user_id = auth.uid() AND trans->>'accountId' IS NOT NULL
  ),
  account_balances AS (
    SELECT
      at.account_id,
      SUM(at.credit - at.debit) AS balance
    FROM all_transactions at
    GROUP BY at.account_id
  ),
  aged_debits AS (
    SELECT
      at.account_id,
      at.date,
      at.debit,
      (CURRENT_DATE - at.date) AS age
    FROM all_transactions at
    WHERE at.debit > 0
  ),
  settled_debits AS (
    SELECT
      ad.account_id,
      ad.age,
      GREATEST(0, ad.debit - COALESCE(SUM(at.credit) OVER (PARTITION BY ad.account_id ORDER BY at.date, at.credit), 0)) AS outstanding_debit
    FROM aged_debits ad
    LEFT JOIN all_transactions at ON ad.account_id = at.account_id AND at.date >= ad.date
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    ab.balance * -1 AS total_outstanding,
    SUM(CASE WHEN sd.age <= 30 THEN sd.outstanding_debit ELSE 0 END) AS days_0_30,
    SUM(CASE WHEN sd.age > 30 AND sd.age <= 60 THEN sd.outstanding_debit ELSE 0 END) AS days_31_60,
    SUM(CASE WHEN sd.age > 60 AND sd.age <= 90 THEN sd.outstanding_debit ELSE 0 END) AS days_61_90,
    SUM(CASE WHEN sd.age > 90 THEN sd.outstanding_debit ELSE 0 END) AS days_over_90
  FROM public.accounts a
  JOIN account_balances ab ON a.id = ab.account_id
  LEFT JOIN settled_debits sd ON a.id = sd.account_id
  WHERE ab.balance < 0
  GROUP BY a.id, a.name, a.type, ab.balance
  ORDER BY a.name;
END;
$$;
