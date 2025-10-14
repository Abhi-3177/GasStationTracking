/*
          # [Fix] Correct Aged Debtors Report Function
          This migration drops the old, faulty `get_aged_debtors_report` function and recreates it with corrected, unambiguous column references to resolve the "column reference is ambiguous" error.

          ## Query Description: "This operation replaces a faulty database function with a corrected version. It is a safe, non-destructive operation with no impact on existing data. The fix is necessary for the 'Aged Debtors Report' to work correctly."
          
          ## Metadata:
          - Schema-Category: "Safe"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Drops function: `get_aged_debtors_report()`
          - Creates function: `get_aged_debtors_report()` with corrected logic.
          
          ## Security Implications:
          - RLS Status: Not Applicable
          - Policy Changes: No
          - Auth Requirements: Uses `auth.uid()` for security.
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Low. Replaces a function definition.
          */

-- Drop the old, faulty function to prevent conflicts.
DROP FUNCTION IF EXISTS public.get_aged_debtors_report();

-- Create the new, corrected function with fully qualified column names.
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
SECURITY DEFINER -- To access all necessary tables
SET search_path = public
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

    -- Payments Received (Credits)
    SELECT
      pr.account_id,
      pr.date::date,
      0 AS debit,
      pr.amount AS credit
    FROM public.payments_received pr
    WHERE pr.user_id = auth.uid()

    UNION ALL

    -- Credit Sales from Day Book (Debits)
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'creditSales') AS sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL

    -- 0332 Sales from Day Book (Debits)
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sales0332') AS sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL

    -- SVI Sales from Day Book (Debits)
    SELECT
      (sale->>'accountId')::uuid,
      dbr.date::date,
      (sale->>'amount')::numeric AS debit,
      0 AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'deductions'->'sviSales') AS sale
    WHERE dbr.user_id = auth.uid() AND sale->>'accountId' IS NOT NULL

    UNION ALL

    -- Cash Transactions from Day Book
    SELECT
      (trans->>'accountId')::uuid,
      dbr.date::date,
      CASE WHEN trans->>'type' = 'out' THEN (trans->>'amount')::numeric ELSE 0 END AS debit,
      CASE WHEN trans->>'type' = 'in' THEN (trans->>'amount')::numeric ELSE 0 END AS credit
    FROM public.day_book_records dbr,
         jsonb_array_elements(dbr.record->'cashTransactions') AS trans
    WHERE dbr.user_id = auth.uid() AND trans->>'accountId' IS NOT NULL
  ),
  aged_debits AS (
    SELECT
      t.account_id,
      t.debit,
      (current_date - t.date) AS age
    FROM all_transactions t
    WHERE t.debit > 0
  ),
  account_credits AS (
    SELECT
      t.account_id,
      SUM(t.credit) AS total_credit
    FROM all_transactions t
    GROUP BY t.account_id
  ),
  settled_debits AS (
    SELECT
      ad.account_id,
      ad.debit,
      ad.age,
      COALESCE(ac.total_credit, 0) - SUM(ad.debit) OVER (PARTITION BY ad.account_id ORDER BY ad.date, ad.debit) AS remaining_credit
    FROM aged_debits ad
    LEFT JOIN account_credits ac ON ad.account_id = ac.account_id
  )
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    SUM(
      CASE
        WHEN sd.remaining_credit < 0 THEN LEAST(sd.debit, -sd.remaining_credit)
        ELSE 0
      END
    ) AS total_outstanding,
    SUM(
      CASE
        WHEN sd.age <= 30 AND sd.remaining_credit < 0 THEN LEAST(sd.debit, -sd.remaining_credit)
        ELSE 0
      END
    ) AS days_0_30,
    SUM(
      CASE
        WHEN sd.age BETWEEN 31 AND 60 AND sd.remaining_credit < 0 THEN LEAST(sd.debit, -sd.remaining_credit)
        ELSE 0
      END
    ) AS days_31_60,
    SUM(
      CASE
        WHEN sd.age BETWEEN 61 AND 90 AND sd.remaining_credit < 0 THEN LEAST(sd.debit, -sd.remaining_credit)
        ELSE 0
      END
    ) AS days_61_90,
    SUM(
      CASE
        WHEN sd.age > 90 AND sd.remaining_credit < 0 THEN LEAST(sd.debit, -sd.remaining_credit)
        ELSE 0
      END
    ) AS days_over_90
  FROM public.accounts a
  LEFT JOIN settled_debits sd ON a.id = sd.account_id
  WHERE a.user_id = auth.uid()
  GROUP BY a.id, a.name, a.type
  HAVING SUM(
      CASE
        WHEN sd.remaining_credit < 0 THEN LEAST(sd.debit, -sd.remaining_credit)
        ELSE 0
      END
    ) > 0;
END;
$$;
