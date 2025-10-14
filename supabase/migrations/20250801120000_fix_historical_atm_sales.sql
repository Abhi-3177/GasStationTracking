/*
# [Data Migration] Fix Historical ATM Sales Dates
This script corrects historical ATM settlement data by moving the 'ATM Sale' amount from its original settlement date to the following day.

## Query Description:
This operation will iterate through all existing 'daily_records' and for each record with an 'ATM Sale' amount, it will:
1. Move the 'ATM Sale' amount to the record of the next calendar day.
2. If a record for the next day does not exist, it will be created.
3. The 'ATM Sale' amount on the original date will be set to zero.
This is a one-time data correction script. It is designed to be safe and will not delete any data, only move it. No backup is strictly required, but it is always good practice.

## Metadata:
- Schema-Category: "Data"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: false

## Structure Details:
- Affects table: public.daily_records
- Affects column: bank_reconciliation

## Security Implications:
- RLS Status: The temporary function runs with the invoker's rights. It assumes the user running the migration has the necessary permissions.
- Policy Changes: No
- Auth Requirements: User must have UPDATE and INSERT permissions on 'daily_records'.

## Performance Impact:
- Indexes: This operation does not add or remove indexes.
- Triggers: This operation will fire any existing triggers on the 'daily_records' table.
- Estimated Impact: The script will loop through all daily records. Performance will depend on the number of records in the table. For a few thousand records, it should be fast.
*/

CREATE OR REPLACE FUNCTION fix_historical_atm_sales()
RETURNS void AS $$
DECLARE
    rec RECORD;
    target_date DATE;
    target_recon JSONB;
BEGIN
    -- This temporary table will hold the changes to avoid complex loop dependencies
    CREATE TEMP TABLE atm_sales_to_move (
        original_date DATE,
        target_date DATE,
        amount NUMERIC,
        user_id UUID
    );

    -- 1. Identify all ATM sales that need to be moved
    INSERT INTO atm_sales_to_move (original_date, target_date, amount, user_id)
    SELECT
        r.date,
        r.date + INTERVAL '1 day',
        (r.bank_reconciliation -> 'atmSale' ->> 'actual')::numeric,
        r.user_id
    FROM
        public.daily_records r
    WHERE
        r.bank_reconciliation IS NOT NULL
        AND r.bank_reconciliation -> 'atmSale' ->> 'actual' IS NOT NULL
        AND (r.bank_reconciliation -> 'atmSale' ->> 'actual')::numeric > 0;

    -- 2. Set the original ATM sale amounts to 0
    UPDATE public.daily_records
    SET bank_reconciliation = jsonb_set(
        COALESCE(bank_reconciliation::jsonb, '{}'::jsonb),
        '{atmSale,actual}',
        '0'::jsonb,
        true
    )
    WHERE date IN (SELECT original_date FROM atm_sales_to_move);

    -- 3. Apply the moved sales to the target dates
    FOR rec IN SELECT * FROM atm_sales_to_move
    LOOP
        -- Check if a record exists for the target date
        SELECT bank_reconciliation INTO target_recon
        FROM public.daily_records
        WHERE date = rec.target_date AND user_id = rec.user_id;

        IF FOUND THEN
            -- Update existing record
            UPDATE public.daily_records
            SET bank_reconciliation = jsonb_set(
                COALESCE(target_recon, '{}'::jsonb),
                '{atmSale,actual}',
                to_jsonb(rec.amount),
                true
            )
            WHERE date = rec.target_date AND user_id = rec.user_id;
        ELSE
            -- Insert a new record for the target date
            INSERT INTO public.daily_records (date, user_id, bank_reconciliation, created_at, updated_at)
            VALUES (
                rec.target_date,
                rec.user_id,
                jsonb_build_object(
                    'atmSale', jsonb_build_object('expected', 0, 'actual', rec.amount, 'matched', false),
                    'phonePeSale', jsonb_build_object('expected', 0, 'actual', 0, 'matched', false),
                    'paytmSale', jsonb_build_object('expected', 0, 'actual', 0, 'matched', false),
                    'cashDeposit', jsonb_build_object('expected', 0, 'actual', 0, 'matched', false)
                ),
                NOW(),
                NOW()
            );
        END IF;
    END LOOP;

    -- Clean up the temporary table
    DROP TABLE atm_sales_to_move;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to perform the data migration
SELECT fix_historical_atm_sales();

-- Drop the temporary function after execution
DROP FUNCTION fix_historical_atm_sales();
