/*
  # [Data Migration] Backfill Account IDs for Historical SVI Sales
  This script ensures that all historical "SVI Sales" recorded in the Day Book are properly linked to an account in the `accounts` table.

  ## Query Description:
  - This script will read every "Day Book" record in your database.
  - For each "SVI Sale" it finds, it will check if an account with that name already exists.
  - If the account does not exist, it will be **automatically created**.
  - It will then update the Day Book record to link the sale to the correct account ID.
  - This is a one-time data cleanup operation and is safe to run. It will not delete any data.

  ## Metadata:
  - Schema-Category: ["Data"]
  - Impact-Level: ["Low"]
  - Requires-Backup: false
  - Reversible: false

  ## Structure Details:
  - Reads from: `public.day_book_records`
  - Reads/Writes to: `public.accounts`
  - Writes to: `public.day_book_records` (updates the `record` JSON column)

  ## Security Implications:
  - RLS Status: N/A (runs with admin privileges)
  - Policy Changes: No
  - Auth Requirements: Admin

  ## Performance Impact:
  - Indexes: Uses existing indexes on `accounts` table.
  - Triggers: None
  - Estimated Impact: May take a few moments to run if you have a very large number of historical records.
*/
create or replace function backfill_svi_accounts() returns void as $$
declare
    rec record;
    svi_sale jsonb;
    account_name text;
    existing_account_id uuid;
    new_account_id uuid;
    user_id_from_record uuid;
    updated_svi_sales jsonb;
    temp_svi_sale jsonb;
    i int;
    current_sales jsonb;
begin
    for rec in select * from public.day_book_records loop
        user_id_from_record := rec.user_id;

        -- Ensure deductions and sviSales exist
        if rec.record->'deductions' is null or rec.record->'deductions'->'sviSales' is null or jsonb_typeof(rec.record->'deductions'->'sviSales') != 'array' then
            continue; -- Skip if no sviSales array
        end if;

        current_sales := rec.record->'deductions'->'sviSales';
        updated_svi_sales := current_sales; -- Start with the original array

        for i in 0..jsonb_array_length(current_sales) - 1 loop
            svi_sale := current_sales->i;
            account_name := trim(svi_sale->>'name');

            -- Only process if there's a name and no accountId
            if account_name is not null and account_name != '' and (svi_sale->>'accountId' is null or svi_sale->>'accountId' = '') then
                -- Check for existing account
                select id into existing_account_id from public.accounts where lower(name) = lower(account_name) and user_id = user_id_from_record limit 1;

                if existing_account_id is not null then
                    -- Account exists, update the JSON object with the ID
                    temp_svi_sale := svi_sale || jsonb_build_object('accountId', existing_account_id);
                else
                    -- Account does not exist, create it
                    insert into public.accounts (user_id, name, type) values (user_id_from_record, account_name, 'factory') returning id into new_account_id;
                    temp_svi_sale := svi_sale || jsonb_build_object('accountId', new_account_id);
                end if;
                
                -- Replace the element in the array at the specific index
                updated_svi_sales := jsonb_set(updated_svi_sales, ARRAY[i::text], temp_svi_sale);
            end if;
        end loop;

        -- Update the record's JSON only if changes were made
        if updated_svi_sales is not null and updated_svi_sales != current_sales then
             update public.day_book_records
             set record = jsonb_set(
                 rec.record,
                 '{deductions,sviSales}',
                 updated_svi_sales
             )
             where date = rec.date and user_id = rec.user_id;
        end if;

    end loop;
end;
$$ language plpgsql volatile;

-- Execute the function
select backfill_svi_accounts();

-- Drop the temporary function
drop function backfill_svi_accounts();
