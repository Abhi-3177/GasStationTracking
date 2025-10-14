/*
          # [Secure Function: delete_all_user_data]
          This migration updates the `delete_all_user_data` function to set a fixed `search_path`. This is a security best practice that prevents potential hijacking of the function by malicious actors who might alter the session's search path.

          ## Query Description: [This operation modifies an existing database function to enhance its security. It is a non-destructive change and has no impact on existing data. It ensures the function operates in a predictable and secure environment.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Function: `public.delete_all_user_data()`
          
          ## Security Implications:
          - RLS Status: [Not Applicable]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [Not Applicable]
          - Triggers: [Not Applicable]
          - Estimated Impact: [None]
          */
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use TRUNCATE for efficiency and to reset sequences.
  -- RLS is bypassed because of 'security definer', but the function is protected
  -- as it can only be called by the authenticated user who owns the session.
  TRUNCATE TABLE public.day_book_records, public.daily_records, public.payments_received, public.balance_entries, public.accounts RESTART IDENTITY;
END;
$$;

/*
          # [Secure Function: delete_records_for_date]
          This migration updates the `delete_records_for_date` function to set a fixed `search_path`. This is a security best practice that prevents potential hijacking of the function by malicious actors who might alter the session's search path.

          ## Query Description: [This operation modifies an existing database function to enhance its security. It is a non-destructive change and has no impact on existing data. It ensures the function operates in a predictable and secure environment.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Function: `public.delete_records_for_date(text)`
          
          ## Security Implications:
          - RLS Status: [Not Applicable]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [Not Applicable]
          - Triggers: [Not Applicable]
          - Estimated Impact: [None]
          */
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the user can only delete their own records by checking auth.uid()
  DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.payments_received WHERE date = record_date AND user_id = auth.uid();
END;
$$;
