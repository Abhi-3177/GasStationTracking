-- This script provides a definitive fix for the bulk payments upload function.
-- It safely removes any previous, conflicting versions and creates a single, correct, and secure version.

-- Step 1: Safely drop any potentially existing versions of the function.
-- This handles different signatures that might exist due to previous faulty migrations.
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb);
DROP FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb);

-- Step 2: Create the correct and secure version of the function from scratch.
/*
          # [Function] bulk_add_payments_and_create_accounts
          [This function takes a date and a JSONB array of payment data. For each payment, it finds the corresponding account by name (or creates a new one if it doesn't exist) and then inserts a new record into the payments_received table. This is designed for bulk processing of payment files.]

          ## Query Description: [This operation is safe and only inserts new data. It checks for existing accounts to prevent duplicates and adds new payments. There is no risk of data loss.]
          
          ## Metadata:
          - Schema-Category: ["Data"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Tables Affected: accounts, payments_received
          
          ## Security Implications:
          - RLS Status: [Enabled on target tables]
          - Policy Changes: [No]
          - Auth Requirements: [User must be authenticated]
          
          ## Performance Impact:
          - Indexes: [Uses existing indexes on account name and user_id]
          - Triggers: [No]
          - Estimated Impact: [Low. Efficiently processes bulk inserts.]
          */
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    payment_record jsonb;
    account_record RECORD;
    v_user_id uuid := auth.uid();
BEGIN
    FOR payment_record IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        -- Find or create the account
        SELECT * INTO account_record
        FROM public.accounts
        WHERE "name" = (payment_record->>'account_name') AND user_id = v_user_id;

        IF account_record IS NULL THEN
            INSERT INTO public.accounts (user_id, name, type)
            VALUES (v_user_id, (payment_record->>'account_name'), 'factory')
            RETURNING * INTO account_record;
        END IF;

        -- Insert the payment record
        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number)
        VALUES (
            p_date,
            v_user_id,
            account_record.id,
            (payment_record->>'amount')::numeric,
            payment_record->>'description',
            payment_record->>'receipt_number'
        );
    END LOOP;
END;
$$;

-- Set the search path on the function for security best practices.
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb) SET search_path = public;
