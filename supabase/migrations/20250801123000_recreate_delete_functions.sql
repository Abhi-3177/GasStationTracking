/*
          # [Function] delete_records_for_date
          Deletes all records (day book, daily record, payments) for a specific date owned by the currently authenticated user.

          ## Query Description: "This operation will permanently delete all data associated with a specific day. This action cannot be undone. Ensure you have selected the correct date before proceeding."
          
          ## Metadata:
          - Schema-Category: "Dangerous"
          - Impact-Level: "High"
          - Requires-Backup: true
          - Reversible: false
          
          ## Structure Details:
          - Tables affected: day_book_records, daily_records, payments_received
          
          ## Security Implications:
          - RLS Status: Bypassed via SECURITY DEFINER
          - Policy Changes: No
          - Auth Requirements: User must be authenticated.
          
          ## Performance Impact:
          - Indexes: Uses primary keys and indexes on `date` and `user_id`.
          - Triggers: No
          - Estimated Impact: Low impact, targets specific rows.
          */
CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the search_path is secure
  SET search_path = public;

  -- Delete from related tables first to respect foreign key constraints if they were to exist.
  DELETE FROM public.payments_received WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.daily_records WHERE date = record_date AND user_id = auth.uid();
  DELETE FROM public.day_book_records WHERE date = record_date AND user_id = auth.uid();
END;
$$;

/*
          # [Function] delete_all_user_data
          Deletes ALL data for the currently authenticated user from all tables.

          ## Query Description: "This operation will permanently delete ALL of your application data, including all day books, daily records, accounts, and payments. This action is irreversible and is equivalent to a factory reset."
          
          ## Metadata:
          - Schema-Category: "Dangerous"
          - Impact-Level: "High"
          - Requires-Backup: true
          - Reversible: false
          
          ## Structure Details:
          - Tables affected: day_book_records, daily_records, payments_received, balance_entries, accounts
          
          ## Security Implications:
          - RLS Status: Bypassed via SECURITY DEFINER
          - Policy Changes: No
          - Auth Requirements: User must be authenticated.
          
          ## Performance Impact:
          - Indexes: N/A (TRUNCATE is used where possible)
          - Triggers: No
          - Estimated Impact: High impact during operation, but fast due to TRUNCATE.
          */
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the search_path is secure
  SET search_path = public;

  -- Use DELETE instead of TRUNCATE because of foreign key relationships
  -- The order is important to avoid constraint violations.
  DELETE FROM public.balance_entries WHERE user_id = auth.uid();
  DELETE FROM public.payments_received WHERE user_id = auth.uid();
  DELETE FROM public.accounts WHERE user_id = auth.uid();
  DELETE FROM public.daily_records WHERE user_id = auth.uid();
  DELETE FROM public.day_book_records WHERE user_id = auth.uid();
END;
$$;
