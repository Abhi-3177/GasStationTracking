/*
# [Operation Name]
[This operation completely removes the "Daily Record" feature and all its associated data from the database. This includes the main `daily_records` table and all tables that depended on it.]

## Query Description: [This is a destructive operation that will permanently delete the following tables and all their data: `bank_reconciliations`, `credit_sales_records`, `commission_records`, `expense_records`, `cash_in_hand_records`, `sale_0332_records`, and `daily_records`. This action cannot be undone. Please ensure you have backed up any necessary data before proceeding.]

## Metadata:
- Schema-Category: ["Dangerous"]
- Impact-Level: ["High"]
- Requires-Backup: [true]
- Reversible: [false]

## Structure Details:
- Tables to be dropped:
  - public.bank_reconciliations
  - public.credit_sales_records
  - public.commission_records
  - public.expense_records
  - public.cash_in_hand_records
  - public.sale_0332_records
  - public.daily_records

## Security Implications:
- RLS Status: [N/A]
- Policy Changes: [No]
- Auth Requirements: [N/A]

## Performance Impact:
- Indexes: [Removed with tables]
- Triggers: [Removed with tables]
- Estimated Impact: [Low, as it's removing unused tables.]
*/

-- Drop all tables that have a foreign key dependency on 'daily_records'.
DROP TABLE IF EXISTS public.bank_reconciliations;
DROP TABLE IF EXISTS public.credit_sales_records;
DROP TABLE IF EXISTS public.commission_records;
DROP TABLE IF EXISTS public.expense_records;
DROP TABLE IF EXISTS public.cash_in_hand_records;
DROP TABLE IF EXISTS public.sale_0332_records;

-- Now that the dependent tables are gone, drop the 'daily_records' table itself.
DROP TABLE IF EXISTS public.daily_records;
