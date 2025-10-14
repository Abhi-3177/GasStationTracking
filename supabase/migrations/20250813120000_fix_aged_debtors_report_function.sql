/*
          # [Function Correction] Fix get_aged_debtors_report
          This migration corrects a critical typo in the `get_aged_debtors_report` function. The previous version incorrectly referenced `ad.date` instead of `ad.age` when bucketing debts, causing the function to crash. This script drops the old, faulty function and recreates it with the correct column reference, ensuring the Aged Debtors Report works as intended.

          ## Query Description: "This operation replaces a faulty database function with a corrected version. It is a safe, non-destructive operation that fixes a bug in the reporting feature. No user data will be altered."
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Drops function: `public.get_aged_debtors_report()`
          - Creates function: `public.get_aged_debtors_report()`
          
          ## Security Implications:
          - RLS Status: [N/A]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [Negligible. Replaces a small function.]
          */

-- Drop the old, faulty function to ensure a clean replacement
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();

-- Recreate the function with the corrected logic
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH all_debits AS (
  -- Balance Entries (Debit)
  SELECT b.account_id, b.date::date, b.amount
  FROM balance_entries b
  WHERE b.type = 'debit'
  UNION ALL
  -- Credit Sales from Day Book
  SELECT (cs.value ->> 'accountId')::uuid, dbr.date::date, (cs.value ->> 'amount')::numeric
  FROM day_book_records dbr, jsonb_array_elements(dbr.record -> 'deductions' -> 'creditSales') AS cs
  WHERE (cs.value ->> 'accountId') IS NOT NULL
  UNION ALL
  -- 0332 Sales from Day Book
  SELECT (s0.value ->> 'accountId')::uuid, dbr.date::date, (s0.value ->> 'amount')::numeric
  FROM day_book_records dbr, jsonb_array_elements(dbr.record -> 'deductions' -> 'sales0332') AS s0
  WHERE (s0.value ->> 'accountId') IS NOT NULL
  UNION ALL
  -- SVI Sales from Day Book
  SELECT (svi.value ->> 'accountId')::uuid, dbr.date::date, (svi.value ->> 'amount')::numeric
  FROM day_book_records dbr, jsonb_array_elements(dbr.record -> 'deductions' -> 'sviSales') AS svi
  WHERE (svi.value ->> 'accountId') IS NOT NULL
  UNION ALL
  -- Cash Transactions (Out) from Day Book
  SELECT (ct.value ->> 'accountId')::uuid, dbr.date::date, (ct.value ->> 'amount')::numeric
  FROM day_book_records dbr, jsonb_array_elements(dbr.record -> 'cashTransactions') AS ct
  WHERE (ct.value ->> 'accountId') IS NOT NULL AND (ct.value ->> 'type') = 'out'
),
all_credits AS (
  -- Balance Entries (Credit)
  SELECT b.account_id, b.amount
  FROM balance_entries b
  WHERE b.type = 'credit'
  UNION ALL
  -- Payments Received
  SELECT pr.account_id, pr.amount
  FROM payments_received pr
  UNION ALL
  -- Cash Transactions (In) from Day Book
  SELECT (ct.value ->> 'accountId')::uuid, (ct.value ->> 'amount')::numeric
  FROM day_book_records dbr, jsonb_array_elements(dbr.record -> 'cashTransactions') AS ct
  WHERE (ct.value ->> 'accountId') IS NOT NULL AND (ct.value ->> 'type') = 'in'
),
account_balances AS (
    SELECT
        a.id AS account_id,
        COALESCE(SUM(d.amount), 0) - COALESCE(SUM(c.amount), 0) AS balance
    FROM
        accounts a
    LEFT JOIN (SELECT account_id, SUM(amount) as amount FROM all_debits GROUP BY account_id) d ON a.id = d.account_id
    LEFT JOIN (SELECT account_id, SUM(amount) as amount FROM all_credits GROUP BY account_id) c ON a.id = c.account_id
    GROUP BY a.id
    HAVING COALESCE(SUM(d.amount), 0) - COALESCE(SUM(c.amount), 0) > 0
),
aged_debts AS (
    SELECT
        d.account_id,
        d.date,
        d.amount,
        (current_date - d.date) AS age,
        SUM(d.amount) OVER (PARTITION BY d.account_id ORDER BY d.date) as cumulative_debit,
        (SELECT COALESCE(SUM(c.amount), 0) FROM all_credits c WHERE c.account_id = d.account_id) as total_credit
    FROM all_debits d
    WHERE d.account_id IN (SELECT account_id FROM account_balances)
)
SELECT
    a.id as account_id,
    a.name::text as account_name,
    a.type::text as account_type,
    ab.balance as total_outstanding,
    SUM(CASE WHEN ad.age <= 30 THEN ad.outstanding ELSE 0 END)::numeric AS days_0_30,
    SUM(CASE WHEN ad.age > 30 AND ad.age <= 60 THEN ad.outstanding ELSE 0 END)::numeric AS days_31_60,
    SUM(CASE WHEN ad.age > 60 AND ad.age <= 90 THEN ad.outstanding ELSE 0 END)::numeric AS days_61_90,
    SUM(CASE WHEN ad.age > 90 THEN ad.outstanding ELSE 0 END)::numeric AS days_over_90
FROM accounts a
JOIN account_balances ab ON a.id = ab.account_id
LEFT JOIN (
    SELECT
        account_id,
        date,
        age,
        CASE
            WHEN cumulative_debit <= total_credit THEN 0
            ELSE LEAST(amount, cumulative_debit - total_credit)
        END as outstanding
    FROM aged_debts
) ad ON a.id = ad.account_id
GROUP BY a.id, a.name, a.type, ab.balance
ORDER BY a.name;
$$;
