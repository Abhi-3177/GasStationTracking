/*
          # [FINAL SECURITY PATCH]
          This script applies the correct security settings to all custom database functions to resolve the critical "Security Definer View" error and multiple "Function Search Path Mutable" warnings.

          ## Query Description: [This operation modifies function metadata to enhance security. It ensures all functions run with the permissions of the calling user, respecting Row Level Security (RLS). This is a safe, non-destructive change with no impact on data.]

          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]

          ## Structure Details:
          Alters the following functions:
          - delete_all_user_data()
          - delete_records_for_date(text)
          - delete_transaction(text)
          - get_monthly_fuel_sales()
          - get_account_sales_fluctuation(date, real)
          - get_aged_debtors_report()
          - get_records_for_carry_forward(date)
          - bulk_create_accounts(jsonb)
          - bulk_add_payments_and_create_accounts(date, jsonb)

          ## Security Implications:
          - RLS Status: [Enforced]
          - Policy Changes: [No]
          - Auth Requirements: [This change ensures auth requirements are respected by all functions.]

          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [None. This is a metadata change.]
          */

-- Apply SECURITY INVOKER to all custom functions to enforce RLS
ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(text) SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(date) SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SECURITY INVOKER;

-- Set a secure search_path for all custom functions
ALTER FUNCTION public.delete_all_user_data() SET search_path = public;
ALTER FUNCTION public.delete_records_for_date(text) SET search_path = public;
ALTER FUNCTION public.delete_transaction(text) SET search_path = public;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = public;
ALTER FUNCTION public.get_account_sales_fluctuation(date, real) SET search_path = public;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = public;
ALTER FUNCTION public.get_records_for_carry_forward(date) SET search_path = public;
ALTER FUNCTION public.bulk_create_accounts(jsonb) SET search_path = public;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(date, jsonb) SET search_path = public;
