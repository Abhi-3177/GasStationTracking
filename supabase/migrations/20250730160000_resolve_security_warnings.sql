/*
          # [SECURITY FIX] Set Function Search Path
          This operation secures the `handle_new_user` function by setting a fixed `search_path`. This prevents potential security vulnerabilities and resolves the "Function Search Path Mutable" warning.

          ## Query Description: [This is a safe, non-destructive operation. It modifies an existing database function to improve its security and stability without affecting any user data. No backup is required.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Modifies the `handle_new_user` function.
          
          ## Security Implications:
          - RLS Status: [No Change]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [No Change]
          - Triggers: [No Change]
          - Estimated Impact: [None]
          */

ALTER FUNCTION public.handle_new_user()
SET search_path = 'public';

-- Optional: You can also apply this to the other function if it exists and is causing a warning.
-- This function might have been from a previous attempt and can be secured as well.
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_public_profile_for_user') THEN
      ALTER FUNCTION public.create_public_profile_for_user()
      SET search_path = 'public';
   END IF;
END $$;
