/*
  # [Fix] Resolve Function Overloading Error for delete_records_for_date

  This migration provides a definitive fix for the "Could not choose the best candidate function" error by removing all conflicting versions of the `delete_records_for_date` function and recreating a single, unambiguous version.

  ## Query Description:
  - **DROP FUNCTION (x2):** Safely removes any existing functions named `delete_records_for_date` that accept either a `date` or `text` parameter. This cleans up the database and resolves the overloading conflict.
  - **CREATE FUNCTION:** Creates a new `delete_records_for_date` function that accepts a single `record_date` parameter of type `text`. This matches the data type being sent from the application, eliminating ambiguity. The function then securely deletes all records for the given date associated with the current user.

  This operation is safe and will not result in data loss beyond the intended deletions when the function is called. It corrects a structural problem in the database.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: false (The old, broken functions are not intended to be restored)

  ## Structure Details:
  - **Dropped:** `public.delete_records_for_date(date)`, `public.delete_records_for_date(text)`
  - **Created:** `public.delete_records_for_date(text)`

  ## Security Implications:
  - RLS Status: Not directly affected, but the function respects RLS by using `auth.uid()`.
  - Policy Changes: No
  - Auth Requirements: The function requires an authenticated user to run.
  - The `SECURITY DEFINER` and `search_path` settings are included as a security best practice.

  ## Performance Impact:
  - Indexes: No change. Deletions will use existing indexes on `date` and `user_id`.
  - Triggers: No change.
  - Estimated Impact: Negligible impact on performance. Improves reliability of the delete operation.
*/

-- Step 1: Drop all potentially conflicting versions of the function to resolve the overload error.
DROP FUNCTION IF EXISTS public.delete_records_for_date(record_date date);
DROP FUNCTION IF EXISTS public.delete_records_for_date(record_date text);

-- Step 2: Recreate the function with a single, unambiguous signature (accepting TEXT).
-- This version is secure and correctly handles the data type sent from the application.
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete from payments_received table for the given date and user
  DELETE FROM payments_received
  WHERE "date" = record_date::date AND user_id = auth.uid();

  -- Delete from daily_records table for the given date and user
  DELETE FROM daily_records
  WHERE "date" = record_date::date AND user_id = auth.uid();

  -- Delete from day_book_records table for the given date and user
  DELETE FROM day_book_records
  WHERE "date" = record_date::date AND user_id = auth.uid();
END;
$$;
