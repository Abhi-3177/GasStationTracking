-- Harden security of analytics functions by setting a fixed search_path.
-- This prevents potential SQL injection vectors.

ALTER FUNCTION public.get_monthly_fuel_sales()
SET search_path = public;

ALTER FUNCTION public.get_account_sales_fluctuation(date, real)
SET search_path = public;

ALTER FUNCTION public.get_aged_debtors_report()
SET search_path = public;
