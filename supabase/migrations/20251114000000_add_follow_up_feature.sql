/*
          # Create Sent Receipts Table
          [This script creates a new table `sent_receipts` to track which debit transactions have been sent to customers for payment follow-up. It also adds Row Level Security to ensure users can only access their own data.]

          ## Query Description: [This is a non-destructive operation that adds a new table and its security policies. It does not affect any existing data.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.sent_receipts`
          - Columns: `id`, `user_id`, `account_id`, `transaction_id`, `sent_at`, `receipt_number`, `amount`, `transaction_date`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (new policies for `sent_receipts`)
          - Auth Requirements: User must be authenticated.
          
          ## Performance Impact:
          - Indexes: Adds a primary key index and a foreign key index.
          - Triggers: None
          - Estimated Impact: Low.
          */

-- Create the table to log sent receipts
CREATE TABLE IF NOT EXISTS public.sent_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_id text NOT NULL,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    receipt_number text,
    amount numeric NOT NULL,
    transaction_date date NOT NULL,
    CONSTRAINT sent_receipts_user_transaction_unique UNIQUE (user_id, transaction_id)
);

-- Enable Row Level Security
ALTER TABLE public.sent_receipts ENABLE ROW LEVEL SECURITY;

-- Policies for sent_receipts
DROP POLICY IF EXISTS "Users can manage their own sent receipts" ON public.sent_receipts;
CREATE POLICY "Users can manage their own sent receipts"
ON public.sent_receipts
FOR ALL
USING (auth.uid() = user_id);
