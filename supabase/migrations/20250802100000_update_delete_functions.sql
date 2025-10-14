/*
          # [Operation Name]
          Create/Replace User Data Deletion Functions

          ## Query Description: [This script creates two secure database functions. `delete_all_user_data` will permanently remove all records (day books, daily records, accounts, etc.) for the user who calls it. `delete_records_for_date` will permanently remove all records for a specific date for the user. These actions are irreversible. It is highly recommended to back up your data before using the `delete_all_user_data` function if the data is important.]
          
          ## Metadata:
          - Schema-Category: ["Dangerous"]
          - Impact-Level: ["High"]
          - Requires-Backup: [true]
          - Reversible: [false]
          
          ## Structure Details:
          - Creates or replaces the function `public.delete_all_user_data()`.
          - Creates or replaces the function `public.delete_records_for_date(date)`.
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [No]
          - Auth Requirements: [These functions can only be called by an authenticated user and will only affect their own data.]
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [The `delete_all_user_data` function may be slow on very large datasets, but is the most secure method for this operation. The `delete_records_for_date` function will be fast.]
          */
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void AS $$
BEGIN
    -- This function deletes all data associated with the currently authenticated user.
    -- It is defined with SECURITY DEFINER to ensure it has the necessary permissions
    -- to bypass RLS policies that might otherwise prevent a clean deletion across tables.
    -- The `WHERE user_id = auth.uid()` clause ensures that it ONLY ever affects the data
    -- of the user calling the function.

    DELETE FROM public.payments_received WHERE user_id = auth.uid();
    DELETE FROM public.daily_records WHERE user_id = auth.uid();
    DELETE FROM public.day_book_records WHERE user_id = auth.uid();
    DELETE FROM public.balance_entries WHERE user_id = auth.uid();
    DELETE FROM public.accounts WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_records_for_date(record_date date)
RETURNS void AS $$
BEGIN
    -- This function deletes all records for a specific date for the authenticated user.
    -- Like the function above, it uses SECURITY DEFINER and a `WHERE` clause with `auth.uid()`
    -- to ensure the operation is both complete and secure.

    DELETE FROM public.payments_received WHERE user_id = auth.uid() AND date = record_date;
    DELETE FROM public.daily_records WHERE user_id = auth.uid() AND date = record_date;
    DELETE FROM public.day_book_records WHERE user_id = auth.uid() AND date = record_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
