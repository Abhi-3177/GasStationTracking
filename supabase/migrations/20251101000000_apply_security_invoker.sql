/*
          # [SECURITY PATCH] Apply SECURITY INVOKER to all custom functions
          This script updates all custom database functions to run with the permissions of the calling user (SECURITY INVOKER). This is a critical security fix that resolves the "Security Definer View" error and ensures that all Row Level Security policies are correctly enforced. It also sets a secure search path for all functions to resolve mutability warnings.

          ## Query Description: [This is a safe metadata update. It changes the security context of existing functions without altering their logic or touching any of your data. No backup is required, and the change is reversible.]
          
          ## Metadata:
          - Schema-Category: ["Safe", "Security"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Alters the security definition for 9 functions.
          
          ## Security Implications:
          - RLS Status: [Enforced]
          - Policy Changes: [No]
          - Auth Requirements: [This change ensures auth requirements (RLS) are properly respected by all functions.]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [None. This is a metadata change with no performance impact.]
          */

-- Apply SECURITY INVOKER and set a secure search path to all custom functions.

-- Function 1: bulk_add_payments_and_create_accounts
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
SECURITY INVOKER
SET search_path = 'public';

-- Function 2: bulk_create_accounts
ALTER FUNCTION public.bulk_create_accounts(accounts_data jsonb)
SECURITY INVOKER
SET search_path = 'public';

-- Function 3: delete_all_user_data
ALTER FUNCTION public.delete_all_user_data()
SECURITY INVOKER
SET search_path = 'public';

-- Function 4: delete_records_for_date
ALTER FUNCTION public.delete_records_for_date(record_date text)
SECURITY INVOKER
SET search_path = 'public';

-- Function 5: delete_transaction
ALTER FUNCTION public.delete_transaction(p_transaction_id text)
SECURITY INVOKER
SET search_path = 'public';

-- Function 6: get_account_sales_fluctuation
ALTER FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real)
SECURITY INVOKER
SET search_path = 'public';

-- Function 7: get_aged_debtors_report
ALTER FUNCTION public.get_aged_debtors_report()
SECURITY INVOKER
SET search_path = 'public';

-- Function 8: get_monthly_fuel_sales
ALTER FUNCTION public.get_monthly_fuel_sales()
SECURITY INVOKER
SET search_path = 'public';

-- Function 9: get_records_for_carry_forward
ALTER FUNCTION public.get_records_for_carry_forward(p_target_date date)
SECURITY INVOKER
SET search_path = 'public';
