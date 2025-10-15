-- Add a unique constraint to prevent duplicate payment entries
-- for the same user and receipt number.
ALTER TABLE public.payments_received
ADD CONSTRAINT payments_received_user_id_receipt_number_key UNIQUE (user_id, receipt_number);
