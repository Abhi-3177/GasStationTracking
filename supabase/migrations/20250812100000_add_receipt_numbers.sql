/*
          # [Structural] Add Receipt Number Column
          This migration adds a new `receipt_number` column to the `payments_received` table to allow for better tracking of transactions.

          ## Query Description: [This operation adds a new text column to the `payments_received` table. It is a non-destructive change and will not affect any existing data. The new column will be `NULL` for all existing rows.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table: `public.payments_received`
          - Column Added: `receipt_number` (type: `TEXT`)
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [Negligible performance impact.]
          */

ALTER TABLE public.payments_received
ADD COLUMN receipt_number TEXT;
