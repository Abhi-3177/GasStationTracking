-- Security Patch for All Custom Functions

-- This script explicitly sets all known custom functions to SECURITY INVOKER
-- and defines a secure search_path. This is a final attempt to resolve the
-- persistent "Security Definer View" warning.

/*
  # [Security Hardening]
  Alter all custom functions to ensure they run with invoker's permissions and have a secure search path.

  ## Query Description: [This operation modifies the security properties of all custom database functions. It is a non-destructive metadata change and does not alter the function logic. It is designed to fix Row-Level Security (RLS) enforcement and resolve security warnings.]

  ## Metadata:
  - Schema-Category: ["Safe"]
  - Impact-Level: ["Low"]
  - Requires-Backup: [false]
  - Reversible: [true]

  ## Structure Details:
  - Alters properties of functions:
    - delete_all_user_data
    - delete_records_for_date
    - delete_transaction
    - get_monthly_fuel_sales
    - get_account_sales_fluctuation
    - get_aged_debtors_report
    - get_records_for_carry_forward
    - bulk_create_accounts
    - bulk_add_payments_and_create_accounts

  ## Security Implications:
  - RLS Status: [Enforced]
  - Policy Changes: [No]
  - Auth Requirements: [Ensures functions respect the calling user's auth context]

  ## Performance Impact:
  - Indexes: [None]
  - Triggers: [None]
  - Estimated Impact: [None]
*/

-- 1. delete_all_user_data
ALTER FUNCTION public.delete_all_user_data() SECURITY INVOKER;
ALTER FUNCTION public.delete_all_user_data() SET search_path = '$user', 'public';

-- 2. delete_records_for_date
ALTER FUNCTION public.delete_records_for_date(record_date text) SECURITY INVOKER;
ALTER FUNCTION public.delete_records_for_date(record_date text) SET search_path = '$user', 'public';

-- 3. delete_transaction
ALTER FUNCTION public.delete_transaction(p_transaction_id text) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(p_transaction_id text) SET search_path = '$user', 'public';

-- 4. get_monthly_fuel_sales
ALTER FUNCTION public.get_monthly_fuel_sales() SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_fuel_sales() SET search_path = '$user', 'public';

-- 5. get_account_sales_fluctuation
ALTER FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real) SECURITY INVOKER;
ALTER FUNCTION public.get_account_sales_fluctuation(current_month_start date, percentage_threshold real) SET search_path = '$user', 'public';

-- 6. get_aged_debtors_report
ALTER FUNCTION public.get_aged_debtors_report() SECURITY INVOKER;
ALTER FUNCTION public.get_aged_debtors_report() SET search_path = '$user', 'public';

-- 7. get_records_for_carry_forward
ALTER FUNCTION public.get_records_for_carry_forward(p_target_date date) SECURITY INVOKER;
ALTER FUNCTION public.get_records_for_carry_forward(p_target_date date) SET search_path = '$user', 'public';

-- 8. bulk_create_accounts
ALTER FUNCTION public.bulk_create_accounts(accounts_data jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_create_accounts(accounts_data jsonb) SET search_path = '$user', 'public';

-- 9. bulk_add_payments_and_create_accounts
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb) SECURITY INVOKER;
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb) SET search_path = '$user', 'public';
