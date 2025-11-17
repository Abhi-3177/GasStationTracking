/*
          # Create Sent Receipts Table
          This migration creates a new table `sent_receipts` to track which debit transactions have been sent to account holders for payment follow-up.

          ## Query Description: This operation is safe and non-destructive. It adds a new table and its associated security policies. It does not modify or delete any existing data.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true (by dropping the table)
          
          ## Structure Details:
          - Table: `public.sent_receipts`
          - Columns: `id`, `user_id`, `account_id`, `transaction_id`, `receipt_number`, `amount`, `transaction_date`, `created_at`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (adds new policies for the `sent_receipts` table)
          - Auth Requirements: Users must be authenticated.
          
          ## Performance Impact:
          - Indexes: Adds a primary key index and a unique index.
          - Triggers: None
          - Estimated Impact: Negligible.
          */
CREATE TABLE IF NOT EXISTS public.sent_receipts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    transaction_id text NOT NULL,
    receipt_number text NULL,
    amount numeric NOT NULL,
    transaction_date date NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sent_receipts_pkey PRIMARY KEY (id),
    CONSTRAINT sent_receipts_user_id_transaction_id_key UNIQUE (user_id, transaction_id),
    CONSTRAINT sent_receipts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
    CONSTRAINT sent_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.sent_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated user to read their own sent receipts" ON public.sent_receipts;
CREATE POLICY "Allow authenticated user to read their own sent receipts"
ON public.sent_receipts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow authenticated user to insert their own sent receipts" ON public.sent_receipts;
CREATE POLICY "Allow authenticated user to insert their own sent receipts"
ON public.sent_receipts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
