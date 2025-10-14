/*
  # [Data Migration] Fix Historical ATM Sale Dates
  This script corrects historical ATM sale settlements that were recorded on the wrong date.

  ## Query Description:
  - This is a ONE-TIME data migration script.
  - It identifies all "ATM Sale" amounts that were recorded in the `daily_records` table.
  - For each amount found, it moves the value from its current date to the record of the FOLLOWING day, creating a new daily record if one does not exist.
  - The original record's ATM Sale amount is then reset to zero.
  - This operation is safe and only modifies the `actual` values within the `bank_reconciliation` data. No other data is affected. It is recommended to back up your `daily_records` table before running if you have critical data.

  ## Metadata:
  - Schema-Category: "Data"
  - Impact-Level: "Medium"
  - Requires-Backup: true
  - Reversible: false

  ## Structure Details:
  - Tables affected: public.daily_records
  - Columns affected: bank_reconciliation

  ## Security Implications:
  - RLS Status: The function runs as the user who executes it, respecting existing RLS policies for record access.
  - Policy Changes: No
  - Auth Requirements: Must be run by an authenticated user.

  ## Performance Impact:
  - Indexes: Does not add or remove indexes.
  - Triggers: Does not add or remove triggers.
  - Estimated Impact: The script will loop through all existing daily records for the user. Performance will depend on the number of records. For a few thousand records, it should complete within seconds.
*/

DO $$
DECLARE
    rec RECORD;
    atm_sale_amount NUMERIC;
    next_day_date DATE;
    next_day_record RECORD;
    current_user_id UUID;
    json_array JSONB;
    json_element JSONB;
    updated_json_array JSONB;
    i INT;
BEGIN
    -- This operation should be run by the user whose data needs migration.
    -- We get the user_id from the session context.
    current_user_id := auth.uid();

    -- Loop through all daily records for the current user that have an ATM sale
    FOR rec IN
        SELECT *
        FROM public.daily_records
        WHERE user_id = current_user_id
          AND jsonb_typeof(bank_reconciliation) = 'array'
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(bank_reconciliation::jsonb) as elem
              WHERE elem->>'type' = 'atmSale' AND (elem->>'actual')::numeric > 0
          )
        ORDER BY date ASC
    LOOP
        -- Find the ATM sale amount in the current record
        atm_sale_amount := 0;
        FOR json_element IN SELECT * FROM jsonb_array_elements(rec.bank_reconciliation::jsonb)
        LOOP
            IF json_element->>'type' = 'atmSale' THEN
                atm_sale_amount := (json_element->>'actual')::numeric;
            END IF;
        END LOOP;

        -- If there's an amount to move
        IF atm_sale_amount > 0 THEN
            -- Calculate the next day
            next_day_date := rec.date::date + INTERVAL '1 day';

            -- Check if a record exists for the next day
            SELECT * INTO next_day_record
            FROM public.daily_records
            WHERE user_id = current_user_id AND date = next_day_date::text;

            -- If next day record exists, update it
            IF FOUND THEN
                updated_json_array := '[]'::jsonb;
                
                -- Check if the next day's record has a reconciliation array
                IF jsonb_typeof(next_day_record.bank_reconciliation) = 'array' THEN
                    FOR json_element IN SELECT * FROM jsonb_array_elements(next_day_record.bank_reconciliation::jsonb)
                    LOOP
                        IF json_element->>'type' = 'atmSale' THEN
                            json_element := jsonb_set(json_element, '{actual}', to_jsonb(((json_element->>'actual')::numeric + atm_sale_amount)));
                        END IF;
                        updated_json_array := updated_json_array || json_element;
                    END LOOP;
                ELSE
                    -- If the next day record exists but has no reconciliation data, create it
                     updated_json_array := jsonb_build_array(
                        jsonb_build_object('type', 'atmSale', 'expected', 0, 'actual', atm_sale_amount, 'matched', false),
                        jsonb_build_object('type', 'phonePeSale', 'expected', 0, 'actual', 0, 'matched', false),
                        jsonb_build_object('type', 'paytmSale', 'expected', 0, 'actual', 0, 'matched', false),
                        jsonb_build_object('type', 'cashDeposit', 'expected', 0, 'actual', 0, 'matched', false)
                    );
                END IF;

                UPDATE public.daily_records
                SET bank_reconciliation = updated_json_array
                WHERE user_id = current_user_id AND date = next_day_date::text;

            -- If next day record does not exist, create it
            ELSE
                INSERT INTO public.daily_records (date, user_id, bank_reconciliation, created_at, updated_at)
                VALUES (
                    next_day_date::text,
                    current_user_id,
                    jsonb_build_array(
                        jsonb_build_object('type', 'atmSale', 'expected', 0, 'actual', atm_sale_amount, 'matched', false),
                        jsonb_build_object('type', 'phonePeSale', 'expected', 0, 'actual', 0, 'matched', false),
                        jsonb_build_object('type', 'paytmSale', 'expected', 0, 'actual', 0, 'matched', false),
                        jsonb_build_object('type', 'cashDeposit', 'expected', 0, 'actual', 0, 'matched', false)
                    ),
                    now(),
                    now()
                );
            END IF;

            -- Now, reset the ATM sale amount on the original record to 0
            updated_json_array := '[]'::jsonb;
            FOR json_element IN SELECT * FROM jsonb_array_elements(rec.bank_reconciliation::jsonb)
            LOOP
                IF json_element->>'type' = 'atmSale' THEN
                    json_element := jsonb_set(json_element, '{actual}', to_jsonb(0));
                END IF;
                updated_json_array := updated_json_array || json_element;
            END LOOP;

            UPDATE public.daily_records
            SET bank_reconciliation = updated_json_array
            WHERE user_id = current_user_id AND date = rec.date;

        END IF;
    END LOOP;
END;
$$;
