/*
          # [Function] get_aged_debtors_report
          This function calculates the aged debt for all accounts.

          ## Query Description: "This function scans all transactions to categorize outstanding credit into age buckets (0-30, 31-60, 61-90, 90+ days). It provides a summary of accounts receivable aging. No data is modified, so it is safe to run. It may be slow on very large datasets."
          
          ## Metadata:
          - Schema-Category: "Safe"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Creates a new function: `get_aged_debtors_report`
          
          ## Security Implications:
          - RLS Status: Not applicable to function definition.
          - Policy Changes: No
          - Auth Requirements: Uses the `auth.uid()` of the calling user.
          
          ## Performance Impact:
          - Indexes: Relies on existing indexes on date and user_id columns.
          - Triggers: None
          - Estimated Impact: Medium query load on `day_book_records`, `payments_received`, and `balance_entries`.
          */
CREATE OR REPLACE FUNCTION public.get_aged_debtors_report()
RETURNS TABLE (
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Balance Entries (Debits)
    SELECT
      be.account_id,
      be.date::date,
      be.amount AS debit,
      0 AS credit
    FROM balance_entries be
    WHERE be.user_id = auth.uid() AND be.type = 'debit'

    UNION ALL

    -- Balance Entries (Credits)
    SELECT
      be.account_id,
      be.date::date,
      0 AS debit,
      be.amount AS credit
    FROM balance_entries be
    WHERE be.user_id = auth.uid() AND be.type = 'credit'

    UNION ALL

    -- Payments Received (Credits)
    SELECT
      pr.account_id,
      pr.date::date,
      0 AS debit,
      pr.amount AS credit
    FROM payments_received pr
    WHERE pr.user_id = auth.uid()

    UNION ALL

    -- Day Book Sales (Debits)
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'creditSales') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL
    
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sales0332') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL
    
    UNION ALL

    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sviSales') sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL
    
    -- Cash Transactions
    SELECT
      (trans->>'accountId')::uuid,
      dbr.date::date,
      CASE WHEN trans->>'type' = 'out' THEN (trans->>'amount')::numeric ELSE 0 END AS debit,
      CASE WHEN trans->>'type' = 'in' THEN (trans->>'amount')::numeric ELSE 0 END AS credit
    FROM day_book_records dbr,
         jsonb_array_elements(dbr.record->'cashTransactions') trans
    WHERE dbr.user_id = auth.uid() AND trans->>'accountId' IS NOT NULL
  ),
  account_balances AS (
    SELECT
      t.account_id,
      SUM(t.credit - t.debit) AS balance
    FROM all_transactions t
    GROUP BY t.account_id
  ),
  outstanding_accounts AS (
    SELECT account_id FROM account_balances WHERE balance < 0
  ),
  aged_debits AS (
    SELECT
      t.account_id,
      t.date,
      t.debit,
      (CURRENT_DATE - t.date) AS age
    FROM all_transactions t
    WHERE t.account_id IN (SELECT oa.account_id FROM outstanding_accounts oa)
      AND t.debit > 0
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    ab.balance * -1 AS total_outstanding,
    SUM(CASE WHEN ad.age <= 30 THEN ad.debit ELSE 0 END) AS days_0_30,
    SUM(CASE WHEN ad.age > 30 AND ad.age <= 60 THEN ad.debit ELSE 0 END) AS days_31_60,
    SUM(CASE WHEN ad.age > 60 AND ad.age <= 90 THEN ad.debit ELSE 0 END) AS days_61_90,
    SUM(CASE WHEN ad.age > 90 THEN ad.debit ELSE 0 END) AS days_over_90
  FROM accounts a
  JOIN account_balances ab ON a.id = ab.account_id
  LEFT JOIN aged_debits ad ON a.id = ad.account_id
  WHERE a.id IN (SELECT oa.account_id FROM outstanding_accounts oa)
  GROUP BY a.id, a.name, a.type, ab.balance
  ORDER BY total_outstanding DESC;
END;
$$;
