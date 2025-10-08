/*
# [SECURITY] Set Search Path for Functions
This migration secures database functions by setting a fixed search_path. This prevents potential hijacking attacks and resolves the "Function Search Path Mutable" security warning.

## Query Description:
- This operation alters the `handle_new_user` function.
- It sets the `search_path` configuration parameter specifically for this function.
- This is a safe, non-destructive operation that improves security.

## Metadata:
- Schema-Category: ["Safe", "Security"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (by altering the function again)
*/
ALTER FUNCTION public.handle_new_user()
SET search_path = public;
