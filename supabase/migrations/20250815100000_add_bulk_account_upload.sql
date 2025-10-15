--
-- Name: bulk_create_accounts(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE OR REPLACE FUNCTION public.bulk_create_accounts(accounts_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    account_record jsonb;
    new_account_id uuid;
    user_id uuid := auth.uid();
BEGIN
    -- Ensure user_id is available
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Loop through each account object in the JSON array
    FOR account_record IN SELECT * FROM jsonb_array_elements(accounts_data)
    LOOP
        -- Insert into accounts table, ignoring duplicates based on name and user_id
        INSERT INTO public.accounts (user_id, name, type, contact, address)
        VALUES (
            user_id,
            to_title_case(account_record->>'name'),
            (account_record->>'type')::public.account_type,
            account_record->>'contact',
            to_title_case(account_record->>'address')
        )
        ON CONFLICT (user_id, name) DO NOTHING
        RETURNING id INTO new_account_id;

        -- If a new account was created (i.e., it didn't conflict), add its opening balance
        IF new_account_id IS NOT NULL THEN
            INSERT INTO public.balance_entries (account_id, user_id, date, description, type, amount)
            VALUES (
                new_account_id,
                user_id,
                CURRENT_DATE,
                'Opening Balance',
                'debit',
                (account_record->>'openingBalance')::numeric
            );
        END IF;
        
        -- Reset new_account_id for the next iteration
        new_account_id := NULL;
    END LOOP;
END;
$function$;
