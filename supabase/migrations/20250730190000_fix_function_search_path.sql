/*
# [Fix Function Search Path]
This migration secures the 'create_public_profile_for_new_user' function by setting a fixed search_path. This resolves the "Function Search Path Mutable" security warning and prevents potential errors where the function cannot find the 'profiles' table, which is a likely cause of the persistent sign-up failures.

## Query Description:
- This operation alters an existing database function.
- It is a safe, non-destructive change that improves security and stability.
- No data will be affected.

## Metadata:
- Schema-Category: ["Safe", "Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (by unsetting the search_path)

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: None
- Mitigates: This directly addresses the "Function Search Path Mutable" security advisory.
*/

ALTER FUNCTION public.create_public_profile_for_new_user()
SET search_path = public;
