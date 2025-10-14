-- Function to delete a transaction based on its prefixed ID
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix text;
    v_id_part text;
    v_record_date date;
    v_day_book_record day_book_records;
    v_day_book_json jsonb;
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Parse the prefixed ID
    v_prefix := split_part(p_transaction_id, '-', 1);
    v_id_part := substring(p_transaction_id from position('-' in p_transaction_id) + 1);

    IF v_prefix = 'be' THEN
        -- Handle Balance Entry
        DELETE FROM public.balance_entries
        WHERE id = v_id_part::uuid AND user_id = auth.uid();

    ELSIF v_prefix = 'pr' THEN
        -- Handle Payment Received
        DELETE FROM public.payments_received
        WHERE id = v_id_part::uuid AND user_id = auth.uid();

    ELSIF v_prefix IN ('cs', 's0', 'sv', 'ct') THEN
        -- Handle transactions stored inside day_book_records JSON
        v_record_date := split_part(v_id_part, '-', 1)::date;
        v_id_part := substring(v_id_part from position('-' in v_id_part) + 1);

        -- Fetch the specific day book record
        SELECT * INTO v_day_book_record
        FROM public.day_book_records
        WHERE date = v_record_date AND user_id = auth.uid();

        IF v_day_book_record IS NOT NULL THEN
            v_day_book_json := v_day_book_record.record::jsonb;

            IF v_prefix = 'cs' THEN
                v_day_book_json := jsonb_set(
                    v_day_book_json,
                    '{deductions,creditSales}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_day_book_json->'deductions'->'creditSales') AS elem WHERE elem->>'id' <> v_id_part)
                );
            ELSIF v_prefix = 's0' THEN
                v_day_book_json := jsonb_set(
                    v_day_book_json,
                    '{deductions,sales0332}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_day_book_json->'deductions'->'sales0332') AS elem WHERE elem->>'id' <> v_id_part)
                );
            ELSIF v_prefix = 'sv' THEN
                 v_day_book_json := jsonb_set(
                    v_day_book_json,
                    '{deductions,sviSales}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_day_book_json->'deductions'->'sviSales') AS elem WHERE elem->>'id' <> v_id_part)
                );
            ELSIF v_prefix = 'ct' THEN
                v_day_book_json := jsonb_set(
                    v_day_book_json,
                    '{cashTransactions}',
                    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_day_book_json->'cashTransactions') AS elem WHERE elem->>'id' <> v_id_part)
                );
            END IF;

            -- Update the record with the modified JSON
            UPDATE public.day_book_records
            SET record = v_day_book_json
            WHERE date = v_record_date AND user_id = auth.uid();
        END IF;

    ELSE
        RAISE EXCEPTION 'Unknown transaction prefix: %', v_prefix;
    END IF;
END;
$$;
