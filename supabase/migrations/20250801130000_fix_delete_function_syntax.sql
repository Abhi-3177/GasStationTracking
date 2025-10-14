/*
# [Fix] Correct `delete_records_for_date` Function Syntax

This migration corrects a syntax error in the `delete_records_for_date` function. The `SET search_path` statement was incorrectly placed inside the function body. This version moves it to the function's configuration clause, which is the correct syntax for PostgreSQL. This also resolves the "Function Search Path Mutable" security advisory.

## Query Description:
This operation replaces the existing `delete_records_for_date` function with a corrected version. It does not alter any table data directly. Running this script is safe and will fix the delete functionality in the application.

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- Modifies: `public.delete_records_for_date` function

## Security Implications:
- RLS Status: [N/A for function, but function is SECURITY DEFINER]
- Policy Changes: [No]
- Auth Requirements: [N/A]
- **Security Fix**: Explicitly sets `search_path` to `public` to prevent search path hijacking attacks.

## Performance Impact:
- Indexes: [N/A]
- Triggers: [N/A]
- Estimated Impact: [None]
*/

CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid := auth.uid();
BEGIN
  -- Delete from payments_received table
  DELETE FROM payments_received
  WHERE
    date = record_date AND user_id = target_user_id;

  -- Delete from daily_records table
  DELETE FROM daily_records
  WHERE
    date = record_date AND user_id = target_user_id;

  -- Delete from day_book_records table
  DELETE FROM day_book_records
  WHERE
    date = record_date AND user_id = target_user_id;
END;
$$;
