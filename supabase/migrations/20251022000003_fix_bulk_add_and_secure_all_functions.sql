/*
          # [Operation Name]
          Fix Missing Function and Secure All Custom Functions

          ## Query Description: [This script provides a definitive fix for recurring migration errors and security advisories. It safely creates the missing 'bulk_add_payments_and_create_accounts' function and then applies the correct security settings (SECURITY INVOKER) to all custom functions in the database. This ensures all database operations run with the permissions of the logged-in user, respecting Row Level Security.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Creates or replaces function: 'bulk_add_payments_and_create_accounts'
          - Alters functions: 'bulk_create_accounts', 'delete_all_user_data', 'delete_records_for_date', 'delete_transaction', 'get_account_sales_fluctuation', 'get_aged_debtors_report', 'get_monthly_fuel_sales', 'get_records_for_carry_forward'
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [admin]
          - This operation is critical for security. It changes functions from the insecure 'SECURITY DEFINER' to the secure 'SECURITY INVOKER' model, which is essential for multi-user applications.
          
          ## Performance Impact:
          - Indexes: [Unaffected]
          - Triggers: [Unaffected]
          - Estimated Impact: [None. This is a metadata change and does not affect query performance.]
          */

-- Step 1: Create or replace the function that was missing in the previous migration.
-- This function is used by the "Paytm Transaction Log Upload" feature.
CREATE OR REPLACE FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    payment jsonb;
    account_name_text text;
    account_id_uuid uuid;
BEGIN
    -- Loop through each payment object in the provided JSON array
    FOR payment IN SELECT * FROM jsonb_array_elements(payments_data)
    LOOP
        account_name_text := trim(payment->>'account_name');

        -- Check if an account with this name already exists for the user
        SELECT id INTO account_id_uuid
        FROM public.accounts
        WHERE name = account_name_text AND user_id = auth.uid();

        -- If the account does not exist, create it
        IF account_id_uuid IS NULL THEN
            INSERT INTO public.accounts (name, type, user_id)
            VALUES (account_name_text, 'factory', auth.uid())
            RETURNING id INTO account_id_uuid;
        END IF;

        -- Insert the payment, linking it to the found or newly created account
        -- Use ON CONFLICT to ignore duplicates based on receipt_number for the same user
        INSERT INTO public.payments_received (date, user_id, account_id, amount, description, receipt_number, payment_method)
        VALUES (
            p_date,
            auth.uid(),
            account_id_uuid,
            (payment->>'amount')::numeric,
            payment->>'description',
            payment->>'receipt_number',
            'Paytm' -- Default payment method for this bulk upload
        )
        ON CONFLICT (user_id, receipt_number) DO NOTHING;
    END LOOP;
END;
$$;


-- Step 2: Apply correct security settings to ALL custom functions to resolve security advisories.
-- This uses ALTER FUNCTION which is safe and won't fail if a function doesn't exist (though it will warn).
-- It ensures all functions run with the permissions of the user, not the function owner.

ALTER FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.bulk_create_accounts(jsonb) SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.delete_records_for_date(text) SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.delete_transaction(text) SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real) SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_records_for_carry_forward(date) SECURITY INVOKER;

-- Also set the search_path for all functions to prevent other warnings.
ALTER FUNCTION IF EXISTS public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;
ALTER FUNCTION IF EXISTS public.bulk_create_accounts(jsonb) SET search_path = public;
ALTER FUNCTION IF EXISTS public.delete_all_user_data() SET search_path = public;
ALTER FUNCTION IF EXISTS public.delete_records_for_date(text) SET search_path = public;
ALTER FUNCTION IF EXISTS public.delete_transaction(text) SET search_path = public;
ALTER FUNCTION IF EXISTS public.get_account_sales_fluctuation(date, real) SET search_path = public;
ALTER FUNCTION IF EXISTS public.get_aged_debtors_report() SET search_path = public;
ALTER FUNCTION IF EXISTS public.get_monthly_fuel_sales() SET search_path = public;
ALTER FUNCTION IF EXISTS public.get_records_for_carry_forward(date) SET search_path = public;
