/*
          # [Function] delete_all_user_data
          Creates a security definer function that allows a user to delete all of their own data from the application tables.

          ## Query Description: "This operation creates a function that, when called, will permanently delete all day books, daily records, payments, and account data associated with the logged-in user. This action is irreversible and should be used with extreme caution. It is recommended to back up data before using this feature."
          
          ## Metadata:
          - Schema-Category: "Dangerous"
          - Impact-Level: "High"
          - Requires-Backup: true
          - Reversible: false
          
          ## Structure Details:
          - Function: `public.delete_all_user_data()`
          - Tables Affected: `day_book_records`, `daily_records`, `payments_received`, `balance_entries`, `accounts`
          
          ## Security Implications:
          - RLS Status: The function uses `SECURITY DEFINER` to bypass RLS for the `DELETE` operations.
          - Policy Changes: No
          - Auth Requirements: The function can only be called by an authenticated user and will only delete data matching `auth.uid()`.
          
          ## Performance Impact:
          - Indexes: Not applicable.
          - Triggers: Not applicable.
          - Estimated Impact: High impact during execution, as it performs delete operations on multiple tables.
          */
CREATE OR REPLACE FUNCTION public.delete_all_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    -- Check if the user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to perform this action.';
    END IF;

    -- Delete from tables with foreign key dependencies first
    DELETE FROM public.payments_received WHERE user_id = current_user_id;
    DELETE FROM public.balance_entries WHERE user_id = current_user_id;

    -- Now delete from the parent tables
    DELETE FROM public.day_book_records WHERE user_id = current_user_id;
    DELETE FROM public.daily_records WHERE user_id = current_user_id;
    DELETE FROM public.accounts WHERE user_id = current_user_id;
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.delete_all_user_data() TO authenticated;
