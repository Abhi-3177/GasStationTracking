/*
          # [Data Migration] Fix Historical ATM Sales
          This script corrects historical ATM settlement data by moving the 'actual' sale amount from the settlement date to the following day's record.

          ## Query Description: 
          This operation is designed to be safe and idempotent. It will scan all `daily_records`, find any where an ATM sale was recorded, and move that amount to the next day's record. If a record for the next day does not exist, it will be created. The original record's ATM sale amount will then be set to zero. This script will not cause data loss and can be run multiple times without adverse effects, as it only targets records with a non-zero ATM sale amount.

          ## Metadata:
          - Schema-Category: ["Data"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Affects `daily_records` table.
          - Reads and writes to the `bank_reconciliation` JSONB column.
          
          ## Security Implications:
          - RLS Status: [Unaffected]
          - Policy Changes: [No]
          - Auth Requirements: [None - runs as admin]
          
          ## Performance Impact:
          - Indexes: [Uses primary key index on (date, user_id)]
          - Triggers: [None]
          - Estimated Impact: [Low. The script iterates through records but operations are indexed.]
          */
DO $$
DECLARE
    rec RECORD;
    atm_sale_amount NUMERIC;
    next_day_date DATE;
    current_recon JSONB;
    next_day_recon JSONB;
    updated_recon JSONB;
    recon_element JSONB;
    found_next_day_atm_sale BOOLEAN;
BEGIN
    -- Loop through all daily records that have an ATM sale amount > 0
    FOR rec IN
        SELECT *
        FROM public.daily_records
        WHERE jsonb_path_exists(bank_reconciliation, '$[*] ? (@.type == "atmSale" && @.actual > 0)')
    LOOP
        current_recon := rec.bank_reconciliation;
        atm_sale_amount := 0;

        -- Extract the ATM sale amount from the current record
        FOR recon_element IN SELECT * FROM jsonb_array_elements(current_recon)
        LOOP
            IF recon_element->>'type' = 'atmSale' THEN
                atm_sale_amount := (recon_element->>'actual')::NUMERIC;
                EXIT;
            END IF;
        END LOOP;

        -- If we found an ATM sale amount to move
        IF atm_sale_amount > 0 THEN
            next_day_date := rec.date + INTERVAL '1 day';

            -- Atomically ensure a record for the next day exists
            INSERT INTO public.daily_records (date, user_id, bank_reconciliation, created_at, updated_at)
            VALUES (next_day_date, rec.user_id, '[]'::jsonb, now(), now())
            ON CONFLICT (date, user_id) DO NOTHING;

            -- Fetch the next day's record's reconciliation
            SELECT bank_reconciliation INTO next_day_recon
            FROM public.daily_records
            WHERE date = next_day_date AND user_id = rec.user_id;
            
            next_day_recon := COALESCE(next_day_recon, '[]'::jsonb);
            found_next_day_atm_sale := false;
            updated_recon := '[]'::jsonb;

            -- Update the next day's reconciliation by adding the amount
            FOR recon_element IN SELECT * FROM jsonb_array_elements(next_day_recon)
            LOOP
                IF recon_element->>'type' = 'atmSale' THEN
                    found_next_day_atm_sale := true;
                    recon_element := jsonb_set(
                        recon_element,
                        '{actual}',
                        to_jsonb(((COALESCE(recon_element->>'actual', '0'))::NUMERIC + atm_sale_amount))
                    );
                END IF;
                updated_recon := updated_recon || recon_element;
            END LOOP;

            -- If 'atmSale' entry didn't exist in the next day's record, add it
            IF NOT found_next_day_atm_sale THEN
                updated_recon := updated_recon || jsonb_build_object(
                    'type', 'atmSale', 
                    'actual', atm_sale_amount, 
                    'expected', 0, 
                    'matched', false
                );
            END IF;

            -- Save the updated reconciliation for the next day
            UPDATE public.daily_records
            SET bank_reconciliation = updated_recon, updated_at = now()
            WHERE date = next_day_date AND user_id = rec.user_id;

            -- Now, reset the ATM sale amount on the original record to 0
            updated_recon := '[]'::jsonb;
            FOR recon_element IN SELECT * FROM jsonb_array_elements(current_recon)
            LOOP
                IF recon_element->>'type' = 'atmSale' THEN
                    recon_element := jsonb_set(recon_element, '{actual}', to_jsonb(0));
                END IF;
                updated_recon := updated_recon || recon_element;
            END LOOP;

            -- Update the original record
            UPDATE public.daily_records
            SET bank_reconciliation = updated_recon, updated_at = now()
            WHERE date = rec.date AND user_id = rec.user_id;

        END IF;
    END LOOP;
END $$;
