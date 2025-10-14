/*
          # [Function Security] Secure Bulk Upload Functions
          [This operation updates the configuration of two existing functions to enhance security by setting a fixed search_path. This mitigates potential risks related to search path hijacking.]

          ## Query Description: [This operation modifies the metadata of the `bulk_add_payments_received` and `bulk_add_credit_sales` functions. It does not alter any user data and is considered a safe, non-destructive update. It is recommended for improving database security.]
          
          ## Metadata:
          - Schema-Category: ["Safe", "Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Functions affected: `bulk_add_payments_received`, `bulk_add_credit_sales`
          
          ## Security Implications:
          - RLS Status: [Not Applicable]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [None]
          */

ALTER FUNCTION public.bulk_add_payments_received(entries jsonb[])
SET search_path = public;

ALTER FUNCTION public.bulk_add_credit_sales(entries jsonb[])
SET search_path = public;
