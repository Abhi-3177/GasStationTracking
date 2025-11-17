/*
          # [Function Security and Logic Fix]
          This migration script addresses a critical security vulnerability and fixes a persistent bug in the carry-forward balance calculation.

          ## Query Description: [This operation alters existing database functions to make them more secure and replaces a flawed function with a more robust one. It ensures that all database functions run with the permissions of the calling user, respecting Row Level Security. It also fixes the carry-forward logic by moving the calculation to the client and having the database provide the necessary data chain.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Alters functions: `delete_all_user_data`, `delete_records_for_date`, `delete_transaction`, `get_monthly_fuel_sales`, `get_account_sales_fluctuation`, `get_aged_debtors_report`.
          - Drops function: `get_carry_forward_balance`.
          - Creates function: `get_records_for_carry_forward`.
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [This change properly enforces existing auth requirements by switching functions to `SECURITY INVOKER`.]
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [Low. The new function is efficient and uses existing indexes.]
          */

-- Step 1: Apply security fixes to all existing functions.
-- This changes them from the default `SECURITY DEFINER` to `SECURITY INVOKER`,
-- ensuring they run with the permissions of the logged-in user.
-- It also sets the search_path to prevent hijacking attacks.

ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;

ALTER FUNCTION public.delete_records_for_date(record_date text) SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(record_date text) SET search_path = public;

ALTER FUNCTION public.delete_transaction(p_transaction_id text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(p_transaction_id text) SET search_path = public;

ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;

ALTER FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real) SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real) SET search_path = public;

ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;

-- Step 2: Drop the old, flawed carry-forward function if it exists.
DROP FUNCTION IF EXISTS public.get_carry_forward_balance(date);

-- Step 3: Create the new, simpler function to get the required records for calculation.
-- This function is much safer as it only fetches data, it does not perform complex calculations.
CREATE OR REPLACE FUNCTION public.get_records_for_carry_forward(p_target_date date)
RETURNS SETOF day_book_records
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_start_date date;
BEGIN
    -- Find the last settled date before the target date.
    -- The chain of calculations will start from the day *after* this.
    SELECT MAX(date)
    INTO v_start_date
    FROM public.day_book_records
    WHERE user_id = auth.uid()
      AND date < p_target_date
      AND (record->>'cashCollected')::boolean IS TRUE;

    -- If no settled date is found, we need to start from the very first record.
    -- So we set the start date to a very early date to include all records before p_target_date.
    IF v_start_date IS NULL THEN
        v_start_date := '1970-01-01';
    END IF;

    -- Return all records between the last settled day and the target day.
    RETURN QUERY
    SELECT *
    FROM public.day_book_records
    WHERE
        user_id = auth.uid()
        AND date > v_start_date
        AND date < p_target_date
    ORDER BY
        date ASC;
END;
$$;
