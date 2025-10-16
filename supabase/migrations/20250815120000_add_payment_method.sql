/*
          # [Structural] Add Payment Method to Payments
          Adds a new `payment_method` text column to the `public.payments_received` table.

          ## Query Description: [This is a safe, non-destructive operation that adds a new, optional column to an existing table. It will not affect any existing data, which will have a NULL value for this new column by default.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.payments_received`
          - Columns Added: `payment_method` (type: `text`)
          
          ## Security Implications:
          - RLS Status: Unchanged
          - Policy Changes: No
          - Auth Requirements: None
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Negligible. Adding a nullable column is a fast metadata change.
          */
ALTER TABLE public.payments_received
ADD COLUMN payment_method TEXT;
