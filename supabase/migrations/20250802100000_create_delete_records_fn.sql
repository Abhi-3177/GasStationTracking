/*
# [Function] Create delete_records_for_date function
This function provides a secure and atomic way to delete all records associated with a specific date for the currently authenticated user.

## Query Description: 
This operation creates a new PostgreSQL function. It is a non-destructive operation on its own, but the function it creates is designed to perform deletions. The function is defined with `SECURITY DEFINER`, which means it will execute with the permissions of the function owner. This is necessary to bypass Row-Level Security (RLS) policies that might otherwise prevent a complete deletion across multiple tables. The function is safe because it strictly scopes all deletions to the `user_id` of the person calling it (`auth.uid()`).

## Metadata:
- Schema-Category: ["Structural", "Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (The function can be dropped)

## Structure Details:
- Creates a new function: `public.delete_records_for_date(record_date date)`

## Security Implications:
- RLS Status: The function itself is not subject to RLS.
- Policy Changes: No.
- Auth Requirements: The function uses `auth.uid()` to ensure users can only delete their own data. The `SECURITY DEFINER` property is used to ensure the deletion is complete and not partially blocked by RLS.

## Performance Impact:
- Indexes: None.
- Triggers: None.
- Estimated Impact: Negligible. This is a schema change that has no performance impact until the function is called.
*/

CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
-- Setting the search_path is a security best practice for SECURITY DEFINER functions
SET search_path = public;
BEGIN
  -- Use the authenticated user's ID to scope the deletion
  DELETE FROM public.payments_received
  WHERE public.payments_received.date = record_date AND public.payments_received.user_id = auth.uid();

  DELETE FROM public.daily_records
  WHERE public.daily_records.date = record_date AND public.daily_records.user_id = auth.uid();

  DELETE FROM public.day_book_records
  WHERE public.day_book_records.date = record_date AND public.day_book_records.user_id = auth.uid();
END;
$$;
