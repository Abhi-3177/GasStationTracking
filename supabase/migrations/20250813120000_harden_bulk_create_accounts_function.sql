-- Harden the bulk_create_accounts function by setting a secure search path.
-- This prevents potential SQL injection vectors and resolves the "Function Search Path Mutable" security advisory.

-- First, drop the existing function to ensure a clean replacement.
DROP FUNCTION IF EXISTS public.bulk_create_accounts(jsonb);

-- Then, recreate it with the SECURITY DEFINER and a fixed search_path.
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    account_record jsonb;
    new_account_id uuid;
BEGIN
    -- Iterate over each account object in the JSONB array
    FOR account_record IN SELECT * FROM jsonb_array_elements(accounts_data)
    LOOP
        -- Check if an account with the same name already exists for the user
        IF NOT EXISTS (
            SELECT 1
            FROM public.accounts
            WHERE
                name = (account_record->>'name')
                AND user_id = auth.uid()
        ) THEN
            -- Insert the new account if it doesn't exist
            INSERT INTO public.accounts (user_id, name, type, contact, address)
            VALUES (
                auth.uid(),
                account_record->>'name',
                (account_record->>'type')::public.account_type,
                account_record->>'contact',
                account_record->>'address'
            )
            RETURNING id INTO new_account_id;

            -- Add the opening balance entry for the newly created account
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
        END IF;
    END LOOP;
END;
$$;
