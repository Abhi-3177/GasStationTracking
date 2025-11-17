/*
          # [Security Patch] Apply SECURITY INVOKER and search_path
          This migration updates all custom database functions to enhance security and ensure they operate under the correct user permissions. It addresses a critical "Security Definer View" advisory and several "Function Search Path Mutable" warnings.

          ## Query Description: [This operation modifies the security context of database functions. It ensures that all functions run with the permissions of the calling user, respecting Row Level Security policies. This is a critical fix for both security and application stability. No data is altered, but function behavior will become more secure and predictable.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Alters the following functions:
            - delete_all_user_data()
            - delete_records_for_date(text)
            - delete_transaction(text)
            - bulk_create_accounts(jsonb)
            - bulk_add_payments_and_create_accounts(date, jsonb)
            - get_records_for_carry_forward(text)
            - get_monthly_fuel_sales()
            - get_account_sales_fluctuation(date, real)
            - get_aged_debtors_report()
          
          ## Security Implications:
          - RLS Status: Enforces RLS by changing functions from SECURITY DEFINER to SECURITY INVOKER.
          - Policy Changes: No.
          - Auth Requirements: Functions will now correctly use the session's auth context.
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [Negligible performance impact. Improves security and correctness.]
          */

-- Set a default, secure search path for the session
SET search_path = 'public';

-- Apply SECURITY INVOKER and set a fixed search_path for all functions

-- Functions with no arguments
ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_all_user_data() SET search_path = 'public';

ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = 'public';

ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = 'public';

-- Functions with one argument
ALTER FUNCTION public.delete_records_for_date(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = 'public';

ALTER FUNCTION public.delete_transaction(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(text) SET search_path = 'public';

ALTER FUNCTION public.bulk_create_accounts(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = 'public';

ALTER FUNCTION public.get_records_for_carry_forward(text) SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(text) SET search_path = 'public';

-- Functions with multiple arguments
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = 'public';

ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = 'public';
