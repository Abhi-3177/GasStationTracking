/*
          # [Function] Fix and Create public.bulk_create_accounts
          [This script safely creates the 'bulk_create_accounts' function and applies security patches to other functions.]

          ## Query Description: [This operation will create a new database function required for the 'Bulk Account Upload' feature. It is a non-destructive, additive change. It also alters the metadata of existing functions to resolve security advisories, which is a safe operation that does not affect your data.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [No]
          - Auth Requirements: [This script sets all custom functions to SECURITY INVOKER, which is the recommended secure setting to enforce RLS.]
          */

-- Create or replace the missing function safely
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER -- Use invoker's permissions to respect RLS
SET search_path = public
AS $$
DECLARE
    account_record jsonb;
    new_account_id uuid;
BEGIN
    IF NOT jsonb_typeof(accounts_data) = 'array' THEN
        RAISE EXCEPTION 'Input must be a JSON array.';
    END IF;

    FOR account_record IN SELECT * FROM jsonb_array_elements(accounts_data)
    LOOP
        -- Insert into accounts table
        INSERT INTO public.accounts (user_id, name, type, contact, address)
        VALUES (
            auth.uid(),
            account_record->>'name',
            (account_record->>'type')::public.account_type,
            account_record->>'contact',
            account_record->>'address'
        )
        RETURNING id INTO new_account_id;

        -- Insert opening balance into balance_entries if it's a positive number
        IF (account_record->>'openingBalance')::numeric > 0 THEN
            INSERT INTO public.balance_entries (user_id, account_id, date, description, type, amount)
            VALUES (
                auth.uid(),
                new_account_id,
                CURRENT_DATE,
                'Opening Balance',
                'debit',
                (account_record->>'openingBalance')::numeric
            );
        END IF;
    END LOOP;
END;
$$;

-- Apply security patches to all other custom functions
ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.delete_records_for_date(text) SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.delete_transaction(text) SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER SET search_path = public;

-- This function was added recently, ensure it is also secure.
-- Note: The function signature (the types inside the parentheses) must match exactly.
ALTER FUNCTION public.get_records_for_carry_forward(date) SECURITY INVOKER SET search_path = public;

-- This function was also mentioned in the project history. Patching it proactively.
-- If it doesn't exist, this command will fail, but it's safe to ignore as the other patches will apply.
-- We will handle its creation if it becomes necessary.
DO $$
BEGIN
   IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'bulk_add_payments_and_create_accounts'
   ) THEN
      ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER SET search_path = public;
   END IF;
END
$$;
