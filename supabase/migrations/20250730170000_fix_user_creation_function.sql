/*
  # [Fix] Corrects the user profile creation function
  This script replaces the existing `handle_new_user` function with a corrected version. It is designed to fix the "Database error creating new user" issue without altering protected `auth` tables.

  ## Query Description:
  - This operation uses `CREATE OR REPLACE` to update the function that automatically creates a user profile upon sign-up.
  - It does NOT drop or create any triggers, avoiding permission errors on the `auth.users` table.
  - It sets the function to run with `SECURITY DEFINER` permissions, allowing it to insert into the `public.profiles` table.
  - It also sets a stable `search_path` to resolve the "Function Search Path Mutable" security warning.
  - This is a safe, non-destructive operation that only modifies the function's logic.

  ## Metadata:
  - Schema-Category: "Safe"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: false (but can be replaced with another function definition)
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set the search path on the function to resolve the security warning
ALTER FUNCTION public.handle_new_user() SET search_path = public;
