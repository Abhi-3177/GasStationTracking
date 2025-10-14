/*
# [Operation] Secure All Functions
This script iterates through all user-created functions in the `public` schema and explicitly sets their `search_path`. This is a security best practice that prevents potential context-switching attacks and resolves the "Function Search Path Mutable" warnings from the Supabase security advisor.

## Query Description:
- This operation is safe and non-destructive. It does not alter the logic of your functions.
- It modifies the metadata of existing functions to make them more secure.
- There is no risk of data loss.

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (manually, by unsetting the search_path)

## Structure Details:
- Affects all functions in the `public` schema.
- No changes to tables, columns, or data.

## Security Implications:
- RLS Status: Not Affected
- Policy Changes: No
- Auth Requirements: None
- Mitigates: `[WARN] Function Search Path Mutable` security advisory.

## Performance Impact:
- Indexes: Not Affected
- Triggers: Not Affected
- Estimated Impact: Negligible. This change only affects function execution context setup, with no noticeable performance impact.
*/
DO $$
DECLARE
    function_record RECORD;
BEGIN
    -- This loop finds all functions in the 'public' schema and sets their search_path.
    -- This is a security best practice to prevent certain classes of attacks.
    FOR function_record IN
        SELECT
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS function_args,
            n.nspname AS schema_name
        FROM
            pg_proc p
        JOIN
            pg_namespace n ON p.pronamespace = n.oid
        WHERE
            n.nspname = 'public' -- Only functions in the public schema
            AND p.prokind = 'f' -- 'f' for normal functions
            AND NOT p.prosecdef -- Exclude security definer functions if needed, though we handle them
    LOOP
        -- Construct and execute the ALTER FUNCTION statement to set the search_path
        -- This makes the function's behavior more predictable and secure.
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public;',
                       function_record.schema_name,
                       function_record.function_name,
                       function_record.function_args);
    END LOOP;
END $$;
