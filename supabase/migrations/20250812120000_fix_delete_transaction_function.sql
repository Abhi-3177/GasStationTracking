-- This migration fixes a critical bug in the delete_transaction function.
-- The previous version would fail with a "not-null constraint" error if the user
-- tried to delete the last item from a JSON array (e.g., the last credit sale).
-- This new version uses COALESCE to ensure that deleting the last item results
-- in an empty array `[]` instead of a NULL value, preventing the crash.

/*
  # [Function Fix] Corrects the `delete_transaction` function
  This operation replaces the existing `delete_transaction` function with a more robust version that prevents a "not-null constraint" violation when deleting the last item from a JSON array within a day book record.

  ## Query Description:
  - **Impact:** This is a safe, non-destructive change that only modifies a database function. It does not alter any of your existing data.
  - **Safety:** This change is essential for application stability and fixes a known crash scenario. There are no risks to your data.
  - **Details:** The function is updated to use `COALESCE(..., '[]'::jsonb)` which guarantees that removing the last element from a list results in an empty list, not a NULL value.

  ## Metadata:
  - Schema-Category: "Safe"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true (by reapplying the previous migration, though not recommended)

  ## Security Implications:
  - RLS Status: Not applicable to function definition.
  - Policy Changes: No.
  - Auth Requirements: The function continues to use `auth.uid()` for security.
*/

-- Drop the old function to ensure a clean replacement
DROP FUNCTION IF EXISTS public.delete_transaction(text);

-- Recreate the function with robust JSON handling
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    parts text[];
    transaction_type text;
    transaction_date date;
    transaction_uuid text;
    day_book_record jsonb;
    updated_array jsonb;
BEGIN
    parts := string_to_array(p_transaction_id, ':');
    transaction_type := parts[1];
    
    IF transaction_type = 'be' THEN
        transaction_uuid := parts[2];
        DELETE FROM public.balance_entries WHERE id::text = transaction_uuid AND user_id = auth.uid();
    ELSIF transaction_type = 'pr' THEN
        transaction_uuid := parts[2];
        DELETE FROM public.payments_received WHERE id::text = transaction_uuid AND user_id = auth.uid();
    ELSIF transaction_type IN ('cs', 's0', 'sv', 'ct_in', 'ct_out') THEN
        transaction_date := parts[2]::date;
        transaction_uuid := parts[3];

        SELECT record INTO day_book_record FROM public.day_book_records WHERE date = transaction_date AND user_id = auth.uid();

        IF day_book_record IS NOT NULL THEN
            IF transaction_type = 'cs' THEN
                updated_array := COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'creditSales') AS elem WHERE elem->>'id' != transaction_uuid), '[]'::jsonb);
                day_book_record := jsonb_set(day_book_record, '{deductions,creditSales}', updated_array, true);
            ELSIF transaction_type = 's0' THEN
                 updated_array := COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sales0332') AS elem WHERE elem->>'id' != transaction_uuid), '[]'::jsonb);
                day_book_record := jsonb_set(day_book_record, '{deductions,sales0332}', updated_array, true);
            ELSIF transaction_type = 'sv' THEN
                 updated_array := COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'deductions'->'sviSales') AS elem WHERE elem->>'id' != transaction_uuid), '[]'::jsonb);
                day_book_record := jsonb_set(day_book_record, '{deductions,sviSales}', updated_array, true);
            ELSIF transaction_type = 'ct_in' OR transaction_type = 'ct_out' THEN
                 updated_array := COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(day_book_record->'cashTransactions') AS elem WHERE elem->>'id' != transaction_uuid), '[]'::jsonb);
                day_book_record := jsonb_set(day_book_record, '{cashTransactions}', updated_array, true);
            END IF;

            IF day_book_record IS NOT NULL THEN
                UPDATE public.day_book_records
                SET record = day_book_record
                WHERE date = transaction_date AND user_id = auth.uid();
            END IF;
        END IF;
    END IF;
END;
$$;
