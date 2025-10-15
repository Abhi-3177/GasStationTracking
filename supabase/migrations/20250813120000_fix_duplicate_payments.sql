/*
  # [Data Cleanup and Integrity] Fix Duplicate Payments
  This script cleans up existing duplicate entries in the 'payments_received' table and adds a unique constraint to prevent future duplicates.

  ## Query Description: [This operation will permanently delete duplicate payment records. It is designed to keep the oldest entry for each transaction and remove all subsequent duplicates. While this is a cleanup operation, backing up your 'payments_received' table is always a good practice before running data modifications.]

  ## Metadata:
  - Schema-Category: ["Data", "Structural"]
  - Impact-Level: ["Medium"]
  - Requires-Backup: true
  - Reversible: false

  ## Structure Details:
  - Deletes rows from 'public.payments_received'.
  - Adds a UNIQUE constraint named 'payments_received_user_id_receipt_number_key' to 'public.payments_received'.

  ## Security Implications:
  - RLS Status: [Unaffected]
  - Policy Changes: [No]
  - Auth Requirements: [None]

  ## Performance Impact:
  - Indexes: [Added]
  - Triggers: [None]
  - Estimated Impact: [A unique index will be created, which will slightly slow down inserts but significantly speed up lookups based on receipt_number and prevent duplicates.]
*/

-- Step 1: Delete duplicate payment records, keeping the oldest one for each transaction.
DELETE FROM public.payments_received
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER(
        PARTITION BY user_id, receipt_number 
        ORDER BY created_at ASC
      ) as rn
    FROM public.payments_received
  ) t
  WHERE t.rn > 1
);

-- Step 2: Add the unique constraint now that the data is clean.
ALTER TABLE public.payments_received
ADD CONSTRAINT payments_received_user_id_receipt_number_key UNIQUE (user_id, receipt_number);
