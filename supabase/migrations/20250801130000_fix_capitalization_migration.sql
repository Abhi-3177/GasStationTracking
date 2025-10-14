-- This script safely capitalizes text fields in all existing records,
-- replacing the previous faulty migration.

-- Step 1: Create a robust title-casing helper function.
CREATE OR REPLACE FUNCTION to_title(p_string TEXT)
RETURNS TEXT AS $$
DECLARE
  v_string TEXT;
BEGIN
  -- Return original string if it's null, empty, or contains non-alpha characters that break the logic.
  IF p_string IS NULL OR p_string = '' OR NOT p_string ~ '^[a-zA-Z0-9\s\.\-\/]+$' THEN
    RETURN p_string;
  END IF;

  SELECT
    string_agg(
      -- Only uppercase the first letter if it's an alphabet character
      CASE 
        WHEN lower(substring(word, 1, 1)) BETWEEN 'a' AND 'z' THEN upper(substring(word, 1, 1)) || lower(substring(word, 2))
        ELSE word
      END,
      ' '
    )
  INTO v_string
  FROM
    regexp_split_to_table(p_string, '\s+') AS word;

  RETURN v_string;
EXCEPTION WHEN others THEN
  -- Fallback in case of any unexpected error during string processing
  RETURN p_string;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create a function to safely process the day_book_record JSONB.
CREATE OR REPLACE FUNCTION capitalize_day_book_jsonb(p_record JSONB)
RETURNS JSONB AS $$
DECLARE
  v_new_record JSONB;
  v_item JSONB;
  v_index INT;
BEGIN
  -- If the input record is null or not a JSON object, return it unchanged.
  IF p_record IS NULL OR jsonb_typeof(p_record) != 'object' THEN
    RETURN p_record;
  END IF;

  v_new_record := p_record;

  -- Safely process each array within the JSONB object.
  -- The `jsonb_path_exists` checks prevent errors if keys are missing.

  -- otherSales
  IF jsonb_path_exists(v_new_record, '$.otherSales[*] ? (@.name != null)') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'otherSales') - 1) LOOP
      v_item := v_new_record -> 'otherSales' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_new_record := jsonb_set(v_new_record, ARRAY['otherSales', v_index::text], v_item);
    END LOOP;
  END IF;

  -- cashInflows
  IF jsonb_path_exists(v_new_record, '$.cashInflows[*] ? (@.name != null)') THEN
     FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'cashInflows') - 1) LOOP
      v_item := v_new_record -> 'cashInflows' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_new_record := jsonb_set(v_new_record, ARRAY['cashInflows', v_index::text], v_item);
    END LOOP;
  END IF;

  -- deductions.sviSales
  IF jsonb_path_exists(v_new_record, '$.deductions.sviSales[*]') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'deductions' -> 'sviSales') - 1) LOOP
      v_item := v_new_record -> 'deductions' -> 'sviSales' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_item := jsonb_set(v_item, '{vehicleNumber}', to_jsonb(upper(v_item ->> 'vehicleNumber')));
      v_new_record := jsonb_set(v_new_record, ARRAY['deductions', 'sviSales', v_index::text], v_item);
    END LOOP;
  END IF;

  -- deductions.sales0332
  IF jsonb_path_exists(v_new_record, '$.deductions.sales0332[*]') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'deductions' -> 'sales0332') - 1) LOOP
      v_item := v_new_record -> 'deductions' -> 'sales0332' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_item := jsonb_set(v_item, '{vehicleNumber}', to_jsonb(upper(v_item ->> 'vehicleNumber')));
      v_new_record := jsonb_set(v_new_record, ARRAY['deductions', 'sales0332', v_index::text], v_item);
    END LOOP;
  END IF;

  -- deductions.creditSales
  IF jsonb_path_exists(v_new_record, '$.deductions.creditSales[*]') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'deductions' -> 'creditSales') - 1) LOOP
      v_item := v_new_record -> 'deductions' -> 'creditSales' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_item := jsonb_set(v_item, '{vehicleNumber}', to_jsonb(upper(v_item ->> 'vehicleNumber')));
      v_new_record := jsonb_set(v_new_record, ARRAY['deductions', 'creditSales', v_index::text], v_item);
    END LOOP;
  END IF;

  -- expenses
  IF jsonb_path_exists(v_new_record, '$.expenses.gasCommissions[*]') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'expenses' -> 'gasCommissions') - 1) LOOP
      v_item := v_new_record -> 'expenses' -> 'gasCommissions' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_new_record := jsonb_set(v_new_record, ARRAY['expenses', 'gasCommissions', v_index::text], v_item);
    END LOOP;
  END IF;
  IF jsonb_path_exists(v_new_record, '$.expenses.additionalExpenses[*]') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'expenses' -> 'additionalExpenses') - 1) LOOP
      v_item := v_new_record -> 'expenses' -> 'additionalExpenses' -> v_index;
      v_item := jsonb_set(v_item, '{name}', to_jsonb(to_title(v_item ->> 'name')));
      v_new_record := jsonb_set(v_new_record, ARRAY['expenses', 'additionalExpenses', v_index::text], v_item);
    END LOOP;
  END IF;

  -- payments.cashDeposits
  IF jsonb_path_exists(v_new_record, '$.payments.cashDeposits[*]') THEN
    FOR v_index IN 0..(jsonb_array_length(v_new_record -> 'payments' -> 'cashDeposits') - 1) LOOP
      v_item := v_new_record -> 'payments' -> 'cashDeposits' -> v_index;
      v_item := jsonb_set(v_item, '{description}', to_jsonb(to_title(v_item ->> 'description')));
      v_new_record := jsonb_set(v_new_record, ARRAY['payments', 'cashDeposits', v_index::text], v_item);
    END LOOP;
  END IF;

  RETURN v_new_record;
EXCEPTION WHEN others THEN
  -- If any error occurs during JSON manipulation, return the original record to prevent failure.
  RETURN p_record;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Perform the updates safely.
-- The COALESCE function is the key safety net. If capitalize_day_book_jsonb returns NULL,
-- it will fall back to the original `record` value, preventing the not-null constraint violation.
UPDATE public.day_book_records
SET record = COALESCE(capitalize_day_book_jsonb(record), record)
WHERE record IS NOT NULL; -- Only process rows that have a record to begin with.

-- Update the accounts table.
UPDATE public.accounts
SET 
  name = to_title(name),
  address = to_title(address);

-- Update the balance entries table.
UPDATE public.balance_entries
SET description = to_title(description);

-- Update payments received table.
UPDATE public.payments_received
SET description = to_title(description);

-- Step 4: Clean up the functions.
DROP FUNCTION capitalize_day_book_jsonb(JSONB);
DROP FUNCTION to_title(TEXT);
