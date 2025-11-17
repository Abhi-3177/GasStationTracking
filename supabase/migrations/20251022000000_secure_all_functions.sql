/*
          # [SECURITY PATCH] Secure All Custom Functions
          [This script applies critical security settings to all custom database functions to resolve the 'Security Definer View' and 'Function Search Path Mutable' advisories.]

          ## Query Description: [This operation alters the metadata of all custom functions to ensure they run with the permissions of the calling user (SECURITY INVOKER) and have a fixed search path. This is a non-destructive, safe operation that is crucial for security and preventing Row-Level Security bypasses.]
          
          ## Metadata:
          - Schema-Category: ["Safe", "Security"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Alters metadata for the following functions:
            - delete_all_user_data()
            - delete_records_for_date(text)
            - delete_transaction(text)
            - get_monthly_fuel_sales()
            - get_account_sales_fluctuation(date, real)
            - get_aged_debtors_report()
            - bulk_create_accounts(jsonb)
            - bulk_add_payments_and_create_accounts(date, jsonb)
            - get_records_for_carry_forward(date)
          
          ## Security Implications:
          - RLS Status: [Enforced]
          - Policy Changes: [No]
          - Auth Requirements: [This patch ensures all functions correctly respect the invoking user's authentication and RLS policies.]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [None. This is a metadata change.]
          */

-- Set all functions to run with the permissions of the user calling them
-- and fix the search path to prevent hijacking. This resolves all current security advisories.

ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;

ALTER FUNCTION public.delete_records_for_date(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = public;

ALTER FUNCTION public.delete_transaction(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;

ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;

ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;

ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;

ALTER FUNCTION public.bulk_create_accounts(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = public;

ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;

ALTER FUNCTION public.get_records_for_carry_forward(date) SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;
