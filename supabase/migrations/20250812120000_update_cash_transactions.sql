-- This script migrates the 'cashInflows' field in day_book_records to a new 'cashTransactions' structure.
-- It is designed to be run once and is safe to re-run.

DO $$
DECLARE
    rec RECORD;
    inflow JSONB;
    new_transactions JSONB;
BEGIN
    FOR rec IN 
        SELECT date, user_id, record 
        FROM public.day_book_records 
        WHERE record->'cashInflows' IS NOT NULL AND jsonb_typeof(record->'cashInflows') = 'array'
    LOOP
        -- Initialize an empty JSON array for the new transactions
        new_transactions := '[]'::jsonb;

        -- Iterate over the old cashInflows array
        FOR inflow IN SELECT * FROM jsonb_array_elements(rec.record->'cashInflows')
        LOOP
            -- Add the 'type: "in"' property to each inflow object
            inflow := inflow || '{"type": "in"}'::jsonb;
            -- Add the transformed object to our new array
            new_transactions := new_transactions || inflow;
        END LOOP;

        -- Update the record: add the new 'cashTransactions' field and remove the old 'cashInflows' field
        UPDATE public.day_book_records
        SET record = (rec.record - 'cashInflows') || jsonb_build_object('cashTransactions', new_transactions)
        WHERE date = rec.date AND user_id = rec.user_id;

    END LOOP;
END $$;
