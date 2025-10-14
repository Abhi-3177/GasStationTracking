-- This migration fixes a critical bug in the delete_transaction function.
-- It drops the old, faulty function and creates a new, robust version
-- that correctly parses composite transaction IDs using a colon (:) separator
-- to avoid ambiguity with date formats.

/*
# [Function Fix] Corrects the `delete_transaction` function
This operation replaces a faulty database function with a corrected version to prevent a fatal parsing error when deleting transactions from the Account Ledger.

## Query Description: [This operation drops and recreates a single database function. It is a safe, non-destructive operation on your data. No backup is required, but it is essential for fixing a critical bug.]

## Metadata:
- Schema-Category: ["Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- Drops function: `public.delete_transaction(text)`
- Creates function: `public.delete_transaction(text)`

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [No]
- Auth Requirements: [Function uses `auth.uid()` to ensure users can only affect their own data.]

## Performance Impact:
- Indexes: [None]
- Triggers: [None]
- Estimated Impact: [Negligible. This is a function definition change.]
*/

-- First, drop the old, faulty function to avoid conflicts.
drop function if exists public.delete_transaction(p_transaction_id text);

-- Create the new, corrected function that correctly parses composite IDs.
create or replace function public.delete_transaction(p_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_type text;
  record_id text;
  record_date date;
  day_book_record jsonb;
  user_id_from_session uuid := auth.uid();
begin
  -- Use a colon (:) as a separator to avoid conflicts with the date format (YYYY-MM-DD)
  transaction_type := split_part(p_transaction_id, ':', 1);
  
  if transaction_type = 'be' then
    record_id := split_part(p_transaction_id, ':', 2);
    delete from public.balance_entries where id = record_id::uuid and user_id = user_id_from_session;
  
  elsif transaction_type = 'pr' then
    record_id := split_part(p_transaction_id, ':', 2);
    delete from public.payments_received where id = record_id::uuid and user_id = user_id_from_session;

  elsif transaction_type in ('cs', 's0', 'sv', 'os', 'ct_in', 'ct_out') then
    -- Correctly parse date and ID from the new format (e.g., "cs:2025-10-10:some-id")
    record_date := split_part(p_transaction_id, ':', 2)::date;
    record_id := split_part(p_transaction_id, ':', 3);

    -- Fetch the specific day book record
    select record into day_book_record from public.day_book_records 
    where date = record_date and user_id = user_id_from_session;

    if day_book_record is not null then
      -- Remove the specific entry from the JSONB array based on its type
      if transaction_type = 'cs' then
        day_book_record := jsonb_set(
          day_book_record,
          '{deductions,creditSales}',
          (select jsonb_agg(elem) from jsonb_array_elements(day_book_record->'deductions'->'creditSales') as elem where elem->>'id' <> record_id)
        );
      elsif transaction_type = 's0' then
         day_book_record := jsonb_set(
          day_book_record,
          '{deductions,sales0332}',
          (select jsonb_agg(elem) from jsonb_array_elements(day_book_record->'deductions'->'sales0332') as elem where elem->>'id' <> record_id)
        );
      elsif transaction_type = 'sv' then
        day_book_record := jsonb_set(
          day_book_record,
          '{deductions,sviSales}',
          (select jsonb_agg(elem) from jsonb_array_elements(day_book_record->'deductions'->'sviSales') as elem where elem->>'id' <> record_id)
        );
      elsif transaction_type = 'os' then
         day_book_record := jsonb_set(
          day_book_record,
          '{otherSales}',
          (select jsonb_agg(elem) from jsonb_array_elements(day_book_record->'otherSales') as elem where elem->>'id' <> record_id)
        );
      elsif transaction_type = 'ct_in' or transaction_type = 'ct_out' then
         day_book_record := jsonb_set(
          day_book_record,
          '{cashTransactions}',
          (select jsonb_agg(elem) from jsonb_array_elements(day_book_record->'cashTransactions') as elem where elem->>'id' <> record_id)
        );
      end if;

      -- Update the day book record with the modified JSON
      update public.day_book_records
      set record = day_book_record, updated_at = now()
      where date = record_date and user_id = user_id_from_session;
    end if;
  end if;
end;
$$;
