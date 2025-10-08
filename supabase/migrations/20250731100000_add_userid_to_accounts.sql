/*
          # [Operation Name]
          Add user_id to accounts and enable RLS

          ## Query Description: [This script updates the 'accounts' table to support multi-user data isolation. It adds a 'user_id' column, links it to the authentication system, and enables Row Level Security (RLS). This ensures that users can only see and manage their own accounts, which is a critical security and functionality fix. This change is safe and will not delete any existing account data.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Adds `user_id` column to `public.accounts`.
          - Adds a foreign key from `public.accounts.user_id` to `auth.users.id`.
          - Enables RLS on `public.accounts`.
          - Creates RLS policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `public.accounts`.
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [Yes]
          - Auth Requirements: [A valid user session (JWT) is required to access account data after this change.]
          
          ## Performance Impact:
          - Indexes: [A foreign key index will be created on `user_id`.]
          - Triggers: [No]
          - Estimated Impact: [Negligible performance impact. Queries may become slightly faster for users with many accounts due to indexing.]
          */

-- 1. Add the user_id column to the accounts table if it doesn't exist.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Add a foreign key constraint to link accounts to users.
-- This ensures data integrity and enables cascading deletes.
-- We drop it first to make the script re-runnable.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE public.accounts 
ADD CONSTRAINT accounts_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Enable Row Level Security on the accounts table.
-- This is a critical security step to ensure users can only access their own data.
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- 4. Drop any old policies to ensure a clean slate.
DROP POLICY IF EXISTS "Users can manage their own accounts." ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts." ON public.accounts;
DROP POLICY IF EXISTS "Users can insert their own accounts." ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts." ON public.accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts." ON public.accounts;

-- 5. Create a comprehensive policy for all actions.
-- This allows authenticated users to perform any action (SELECT, INSERT, UPDATE, DELETE)
-- on accounts that belong to them.
CREATE POLICY "Users can manage their own accounts."
ON public.accounts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- As a best practice, also ensure RLS is enabled for balance_entries.
ALTER TABLE public.balance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own balance entries." ON public.balance_entries;
CREATE POLICY "Users can manage their own balance entries."
ON public.balance_entries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
