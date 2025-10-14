/*
          # Create Bulk Transaction Functions
          This migration creates two new PostgreSQL functions, `bulk_add_payments_received` and `bulk_add_credit_sales`, to allow for the efficient bulk insertion of ledger entries from a file upload.

          ## Query Description: This operation is safe and adds new functionality to the database. It does not modify any existing data. It creates two new functions that will be used by the application to improve performance during bulk data uploads.
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true] (The functions can be dropped)
          
          ## Structure Details:
          - Creates function: `public.bulk_add_payments_received(jsonb)`
          - Creates function: `public.bulk_add_credit_sales(jsonb)`
          
          ## Security Implications:
          - RLS Status: [N/A]
          - Policy Changes: [No]
          - Auth Requirements: [The functions use the calling user's ID to ensure data security.]
          
          ## Performance Impact:
          - Indexes: [N/A]
          - Triggers: [N/A]
          - Estimated Impact: [Positive. These functions will significantly reduce the number of database calls required for bulk uploads, improving performance.]
          */

CREATE OR REPLACE FUNCTION public.bulk_add_payments_received(entries jsonb)
RETURNS void AS $$
DECLARE
    entry jsonb;
BEGIN
    FOR entry IN SELECT * FROM jsonb_array_elements(entries)
    LOOP
        INSERT INTO public.payments_received (date, account_id, amount, description, receipt_number, user_id)
        VALUES (
            (entry->>'date')::date,
            (entry->>'accountId')::uuid,
            (entry->>'amount')::numeric,
            entry->>'description',
            entry->>'receiptNumber',
            auth.uid()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.bulk_add_credit_sales(entries jsonb)
RETURNS void AS $$
DECLARE
    entry jsonb;
    target_date date;
    user_id uuid := auth.uid();
    day_book_record jsonb;
    new_sale_entry jsonb;
BEGIN
    FOR entry IN SELECT * FROM jsonb_array_elements(entries)
    LOOP
        target_date := (entry->>'date')::date;

        -- Fetch the existing day book record for the target date
        SELECT record INTO day_book_record
        FROM public.day_book_records
        WHERE date = target_date AND user_id = user_id;

        -- Create a new credit sale entry
        new_sale_entry := jsonb_build_object(
            'id', (EXTRACT(EPOCH FROM now()) * 1000)::text || (random() * 1000)::int::text,
            'name', entry->>'description',
            'accountId', entry->>'accountId',
            'litres', (entry->>'litres')::numeric,
            'fuelType', 'diesel', -- Defaulting fuel type, can be enhanced later
            'amount', (entry->>'amount')::numeric,
            'lastEdited', 'amount',
            'vehicleNumber', entry->>'vehicleNumber',
            'receiptNumber', entry->>'receiptNumber'
        );

        IF day_book_record IS NULL THEN
            -- If no record exists, create a new one with the credit sale
            day_book_record := jsonb_build_object(
                'date', target_date,
                'deductions', jsonb_build_object(
                    'creditSales', jsonb_build_array(new_sale_entry)
                ),
                'machines', '{"petrol": [], "diesel": []}',
                'prices', '{"petrol": 0, "diesel": 0}',
                'otherSales', '[]',
                'cashTransactions', '[]',
                'expenses', '{"gasCommissions": [], "additionalExpenses": [], "gasTesting": {"petrolTestLitres": 0, "dieselTestLitres": 0}}',
                'payments', '{"atmSale": 0, "phonePeSale": 0, "paytmSale": 0, "cashDeposits": []}'
            );
        ELSE
            -- If a record exists, append the new credit sale
            IF jsonb_typeof(day_book_record->'deductions'->'creditSales') IS NULL THEN
                day_book_record := jsonb_set(
                    day_book_record,
                    '{deductions,creditSales}',
                    jsonb_build_array(new_sale_entry)
                );
            ELSE
                day_book_record := jsonb_set(
                    day_book_record,
                    '{deductions,creditSales}',
                    (day_book_record->'deductions'->'creditSales') || new_sale_entry
                );
            END IF;
        END IF;

        -- Upsert the modified day book record
        INSERT INTO public.day_book_records (date, user_id, record, updated_at)
        VALUES (target_date, user_id, day_book_record, now())
        ON CONFLICT (date, user_id) DO UPDATE
        SET record = EXCLUDED.record, updated_at = now();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
