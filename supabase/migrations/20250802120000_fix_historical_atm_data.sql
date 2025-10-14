/*
          # [Data Migration] Correct Historical ATM Settlement Dates
          This script corrects historical ATM settlement data by moving the 'actual' amount for 'atmSale' from its original date to the following day's record. This aligns all past data with the business logic that ATM sales should be reflected on the day after settlement.

          ## Query Description: ["This operation will modify existing 'daily_records' to correct financial data. It will move 'atmSale' amounts to the next calendar day. While data is being moved, not lost, it is always best practice to have a recent backup before running data migrations."]
          
          ## Metadata:
          - Schema-Category: ["Data"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: [true]
          - Reversible: [false]
          
          ## Structure Details:
          - Tables affected: public.daily_records
          - Columns affected: bank_reconciliation (JSONB)
          
          ## Security Implications:
          - RLS Status: [Enabled] - The script runs as the authenticated user and will only affect their own data.
          - Policy Changes: [No]
          - Auth Requirements: [Authenticated User]
          
          ## Performance Impact:
          - Indexes: [Utilizes existing indexes on 'date' and 'user_id']
          - Triggers: [No]
          - Estimated Impact: [Low to Medium, depending on the number of records. The script iterates through records with ATM sales.]
          */
DO $$
DECLARE
    rec RECORD;
    atm_amount NUMERIC;
    next_date DATE;
    next_day_rec RECORD;
    current_atm_on_next_day NUMERIC;
    new_reconciliation JSONB;
    original_reconciliation JSONB;
BEGIN
    -- Loop through all daily records for the current user that have a non-zero ATM sale amount.
    FOR rec IN 
        SELECT * FROM public.daily_records
        WHERE user_id = auth.uid()
          AND (bank_reconciliation->'atmSale' IS NOT NULL) -- Ensure the key exists
          AND ((bank_reconciliation->'atmSale'->>'actual')::numeric > 0)
    LOOP
        -- Get the ATM amount and the original reconciliation object from the current record
        atm_amount := (rec.bank_reconciliation->'atmSale'->>'actual')::numeric;
        original_reconciliation := rec.bank_reconciliation;
        next_date := rec.date + INTERVAL '1 day';

        -- Step 1: Update the original record to zero out the ATM sale amount.
        UPDATE public.daily_records
        SET bank_reconciliation = jsonb_set(
            original_reconciliation,
            '{atmSale,actual}',
            '0'::jsonb,
            true -- create_missing, just in case
        )
        WHERE date = rec.date AND user_id = auth.uid();

        -- Step 2: Find the record for the next day.
        SELECT * INTO next_day_rec FROM public.daily_records WHERE date = next_date AND user_id = auth.uid();

        -- Step 3: Upsert the amount to the next day's record.
        IF FOUND THEN
            -- Record for the next day exists, so update it.
            current_atm_on_next_day := COALESCE((next_day_rec.bank_reconciliation->'atmSale'->>'actual')::numeric, 0);
            
            UPDATE public.daily_records
            SET bank_reconciliation = jsonb_set(
                next_day_rec.bank_reconciliation,
                '{atmSale,actual}',
                (current_atm_on_next_day + atm_amount)::text::jsonb,
                true
            )
            WHERE date = next_date AND user_id = auth.uid();
        ELSE
            -- No record for the next day, so create a new one.
            new_reconciliation := '[
                {"type": "atmSale", "expected": 0, "actual": 0, "matched": false},
                {"type": "phonePeSale", "expected": 0, "actual": 0, "matched": false},
                {"type": "paytmSale", "expected": 0, "actual": 0, "matched": false},
                {"type": "cashDeposit", "expected": 0, "actual": 0, "matched": false}
            ]'::jsonb;
            
            -- Find the 'atmSale' object and update its 'actual' value
            FOR i IN 0..jsonb_array_length(new_reconciliation)-1 LOOP
                IF new_reconciliation->i->>'type' = 'atmSale' THEN
                    new_reconciliation := jsonb_set(new_reconciliation, ARRAY[i::text, 'actual'], atm_amount::text::jsonb);
                    EXIT;
                END IF;
            END LOOP;

            INSERT INTO public.daily_records (date, user_id, bank_reconciliation, created_at, updated_at)
            VALUES (next_date, auth.uid(), new_reconciliation, NOW(), NOW());
        END IF;

    END LOOP;
END $$;
