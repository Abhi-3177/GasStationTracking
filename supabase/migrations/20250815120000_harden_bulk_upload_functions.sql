-- Harden the security of the bulk account creation function
ALTER FUNCTION public.bulk_create_accounts(accounts_data jsonb)
SET search_path = public;

-- Harden the security of the bulk payments creation function
ALTER FUNCTION public.bulk_add_payments_and_create_accounts(p_date date, payments_data jsonb)
SET search_path = public;
