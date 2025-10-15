-- Harden the security of the bulk_create_accounts function
-- This sets a fixed search_path to prevent potential SQL injection vectors.

ALTER FUNCTION public.bulk_create_accounts(accounts_data jsonb)
SET search_path = public;
