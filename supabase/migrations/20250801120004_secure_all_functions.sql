/*
# [Comprehensive Security Fix: Secure All Functions]
This script automatically secures all user-defined functions in the 'public' schema by setting a fixed `search_path`. This resolves the "Function Search Path Mutable" security advisory for all current and future functions.

## Query Description:
This operation iterates through all functions in your `public` schema and applies a security setting (`SET search_path = public`). This is a safe, non-destructive operation that enhances security by preventing potential search path hijacking attacks. It does not modify function logic or data.

## Metadata:
- Schema-Category: ["Safe", "Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (manually, by resetting the search_path on each function)

## Structure Details:
- Affects all functions in the `public` schema.
- Modifies function configuration metadata.

## Security Implications:
- RLS Status: Not Affected
- Policy Changes: No
- Auth Requirements: Requires permissions to alter functions (typically `postgres` role).
- Mitigates: "Function Search Path Mutable" security vulnerability.

## Performance Impact:
- Indexes: Not Affected
- Triggers: Not Affected
- Estimated Impact: Negligible. This is a one-time configuration change.
*/

DO $$
DECLARE
    function_record RECORD;
BEGIN
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
            n.nspname = 'public' -- Only target functions in the public schema
            AND p.prokind = 'f' -- 'f' for regular functions
            -- Exclude system functions and extensions
            AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    LOOP
        -- Construct and execute the ALTER FUNCTION statement to make it secure
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public;',
                       function_record.schema_name,
                       function_record.function_name,
                       function_record.function_args);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
