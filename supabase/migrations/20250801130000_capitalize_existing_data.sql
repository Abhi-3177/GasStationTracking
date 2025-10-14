/*
          # [Data Cleanup] Capitalize Existing Text Fields
          This script will run a one-time data cleanup operation to standardize text formatting across your database. It will apply title case capitalization (e.g., "john doe" becomes "John Doe") to all descriptive fields and uppercase formatting to vehicle numbers.

          ## Query Description: This is a safe, non-destructive data update. It only reformats existing text; it does not delete or change the meaning of the data. No backup is strictly required, but it is always a good practice before running any data migration.
          
          ## Metadata:
          - Schema-Category: ["Data"]
          - Impact-Level: ["Low"]
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Tables affected: `day_book_records`, `accounts`, `balance_entries`, `payments_received`.
          - Columns affected: `name`, `description`, `address`, `vehicleNumber` and their equivalents within JSONB data.
          
          ## Security Implications:
          - RLS Status: [Enabled/Disabled]
          - Policy Changes: [No]
          - Auth Requirements: [Admin privileges to run migrations]
          
          ## Performance Impact:
          - Indexes: [Not Affected]
          - Triggers: [Not Affected]
          - Estimated Impact: [This will cause a one-time load on the database while it updates all historical records. The duration depends on the amount of data.]
          */
BEGIN;

-- Create a temporary function to capitalize text fields within the day_book_records JSONB
CREATE OR REPLACE FUNCTION capitalize_day_book_jsonb(record_jsonb jsonb)
RETURNS jsonb AS $$
DECLARE
    new_svi_sales jsonb;
    new_sales_0332 jsonb;
    new_credit_sales jsonb;
    new_other_sales jsonb;
    new_cash_inflows jsonb;
    new_gas_commissions jsonb;
    new_additional_expenses jsonb;
    new_cash_deposits jsonb;
BEGIN
    -- SVI Sales
    IF jsonb_typeof(record_jsonb->'deductions'->'sviSales') = 'array' THEN
        SELECT jsonb_agg(
            jsonb_set(
                jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))),
                '{vehicleNumber}', to_jsonb(upper(elem->>'vehicleNumber'))
            )
        )
        INTO new_svi_sales
        FROM jsonb_array_elements(record_jsonb->'deductions'->'sviSales') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{deductions,sviSales}', new_svi_sales);
    END IF;
    
    -- 0332 Sales
    IF jsonb_typeof(record_jsonb->'deductions'->'sales0332') = 'array' THEN
        SELECT jsonb_agg(
            jsonb_set(
                jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))),
                '{vehicleNumber}', to_jsonb(upper(elem->>'vehicleNumber'))
            )
        )
        INTO new_sales_0332
        FROM jsonb_array_elements(record_jsonb->'deductions'->'sales0332') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{deductions,sales0332}', new_sales_0332);
    END IF;

    -- Credit Sales
    IF jsonb_typeof(record_jsonb->'deductions'->'creditSales') = 'array' THEN
        SELECT jsonb_agg(
            jsonb_set(
                jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))),
                '{vehicleNumber}', to_jsonb(upper(elem->>'vehicleNumber'))
            )
        )
        INTO new_credit_sales
        FROM jsonb_array_elements(record_jsonb->'deductions'->'creditSales') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{deductions,creditSales}', new_credit_sales);
    END IF;

    -- Other Sales
    IF jsonb_typeof(record_jsonb->'otherSales') = 'array' THEN
        SELECT jsonb_agg(jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))))
        INTO new_other_sales
        FROM jsonb_array_elements(record_jsonb->'otherSales') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{otherSales}', new_other_sales);
    END IF;

    -- Cash Inflows
    IF jsonb_typeof(record_jsonb->'cashInflows') = 'array' THEN
        SELECT jsonb_agg(jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))))
        INTO new_cash_inflows
        FROM jsonb_array_elements(record_jsonb->'cashInflows') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{cashInflows}', new_cash_inflows);
    END IF;

    -- Gas Commissions
    IF jsonb_typeof(record_jsonb->'expenses'->'gasCommissions') = 'array' THEN
        SELECT jsonb_agg(jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))))
        INTO new_gas_commissions
        FROM jsonb_array_elements(record_jsonb->'expenses'->'gasCommissions') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{expenses,gasCommissions}', new_gas_commissions);
    END IF;

    -- Additional Expenses
    IF jsonb_typeof(record_jsonb->'expenses'->'additionalExpenses') = 'array' THEN
        SELECT jsonb_agg(jsonb_set(elem, '{name}', to_jsonb(initcap(elem->>'name'))))
        INTO new_additional_expenses
        FROM jsonb_array_elements(record_jsonb->'expenses'->'additionalExpenses') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{expenses,additionalExpenses}', new_additional_expenses);
    END IF;
    
    -- Cash Deposits
    IF jsonb_typeof(record_jsonb->'payments'->'cashDeposits') = 'array' THEN
        SELECT jsonb_agg(jsonb_set(elem, '{description}', to_jsonb(initcap(elem->>'description'))))
        INTO new_cash_deposits
        FROM jsonb_array_elements(record_jsonb->'payments'->'cashDeposits') AS elem;
        record_jsonb := jsonb_set(record_jsonb, '{payments,cashDeposits}', new_cash_deposits);
    END IF;

    RETURN record_jsonb;
END;
$$ LANGUAGE plpgsql;

-- Update day_book_records using the function
UPDATE day_book_records
SET record = capitalize_day_book_jsonb(record);

-- Update accounts table
UPDATE accounts
SET 
  name = initcap(name),
  address = initcap(address);

-- Update balance_entries table
UPDATE balance_entries
SET description = initcap(description);

-- Update payments_received table
UPDATE payments_received
SET description = initcap(description);

COMMIT;

-- Clean up the temporary function
DROP FUNCTION capitalize_day_book_jsonb(jsonb);
