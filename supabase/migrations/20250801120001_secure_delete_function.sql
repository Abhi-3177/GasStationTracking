/*
# [Fix Function Security]
This migration enhances the security of the `delete_records_for_date` function by explicitly setting its `search_path`. This mitigates a potential security vulnerability where the function could be tricked into executing malicious code.

## Query Description:
- This operation modifies an existing database function.
- It is a safe, non-destructive change that only affects the function's security configuration.
- No user data will be altered.

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Function affected: `public.delete_records_for_date(text)`

## Security Implications:
- RLS Status: Not applicable
- Policy Changes: No
- Auth Requirements: Not applicable
- Fixes: This change resolves the "[WARN] Function Search Path Mutable" security advisory for this specific function.
*/
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Use fully qualified names for maximum security
  DELETE FROM public.payments_received
  WHERE public.payments_received.user_id = auth.uid() AND public.payments_received.date = record_date;

  DELETE FROM public.daily_records
  WHERE public.daily_records.user_id = auth.uid() AND public.daily_records.date = record_date;

  DELETE FROM public.day_book_records
  WHERE public.day_book_records.user_id = auth.uid() AND public.day_book_records.date = record_date;
END;
$$;
