/*
          # [DEFINITIVE SECURITY PATCH]
          This script applies the correct security settings to all custom database functions.
          It sets all functions to `SECURITY INVOKER` to ensure they respect Row-Level Security (RLS) policies.
          It also sets a fixed `search_path` to prevent potential hijacking attacks.

          ## Query Description: [This operation modifies function metadata to enhance security. It is a safe, non-destructive change that does not alter function logic or user data. It is critical for ensuring the application behaves correctly and securely.]
          
          ## Metadata:
          - Schema-Category: ["Safe", "Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Alters metadata for all 9 custom functions.
          
          ## Security Implications:
          - RLS Status: [Enforced]
          - Policy Changes: [No]
          - Auth Requirements: [This change ensures all functions run with the permissions of the authenticated user, enforcing RLS.]
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [None]
          */

-- Set SECURITY INVOKER for all functions
ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(text) SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(date) SECURITY INVOKER;

-- Set a secure search_path for all functions
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = public;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = public;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;
