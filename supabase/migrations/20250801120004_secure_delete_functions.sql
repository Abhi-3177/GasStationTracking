/*
# [Security Fix] Set Function Search Path
This migration updates existing database functions to explicitly set the `search_path`. This is a security best practice that prevents potential hijacking of function execution by malicious actors who might create objects in other schemas.

## Query Description:
This operation alters the configuration of the `delete_all_user_data` and `delete_records_for_date` functions. It does not change their logic or affect any existing data. It makes the functions more secure by restricting the schemas they can search for objects in.

## Metadata:
- Schema-Category: ["Safe", "Security"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Functions affected:
  - `public.delete_all_user_data()`
  - `public.delete_records_for_date(date)`

## Security Implications:
- RLS Status: Not applicable
- Policy Changes: No
- Auth Requirements: Not applicable
- **Improvement**: This change directly addresses the "Function Search Path Mutable" security advisory by setting a fixed, safe search path.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. This is a configuration change.
*/

ALTER FUNCTION public.delete_all_user_data()
SET search_path = public;

ALTER FUNCTION public.delete_records_for_date(record_date date)
SET search_path = public;
