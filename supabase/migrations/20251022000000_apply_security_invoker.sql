/*
          # [SECURITY] Apply SECURITY INVOKER to all custom functions
          This migration alters all custom functions to run with the permissions of the calling user (SECURITY INVOKER) and sets a secure search path. This is a critical security fix that resolves the "Security Definer View" error and ensures Row Level Security (RLS) is properly enforced.

          ## Query Description: [This operation modifies the security metadata of existing database functions. It is a non-destructive change and does not alter the logic or data within the functions. This change is essential for security and correct application behavior.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Alters the following functions:
            - bulk_add_payments_and_create_accounts
            - bulk_create_accounts
            - delete_all_user_data
            - delete_records_for_date
            - delete_transaction
            - get_account_sales_fluctuation
            - get_aged_debtors_report
            - get_monthly_fuel_sales
            - get_records_for_carry_forward
          
          ## Security Implications:
          - RLS Status: [Enforced]
          - Policy Changes: [No]
          - Auth Requirements: [This change ensures functions respect auth.uid() and RLS policies.]
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [None]
          */

-- Apply SECURITY INVOKER and set search_path for all custom functions

-- Function: bulk_add_payments_and_create_accounts
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;

-- Function: bulk_create_accounts
ALTER FUNCTION public.bulk_create_accounts(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = public;

-- Function: delete_all_user_data
ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;

-- Function: delete_records_for_date
ALTER FUNCTION public.delete_records_for_date(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = public;

-- Function: delete_transaction
ALTER FUNCTION public.delete_transaction(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;

-- Function: get_account_sales_fluctuation
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;

-- Function: get_aged_debtors_report
ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;

-- Function: get_monthly_fuel_sales
ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;

-- Function: get_records_for_carry_forward
ALTER FUNCTION public.get_records_for_carry_forward(date) SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;
