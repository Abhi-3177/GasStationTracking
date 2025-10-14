/*
          # [Function Security Hardening]
          Sets the search_path for user-defined functions to resolve security warnings.

          ## Query Description: [This operation enhances security by explicitly setting the execution path for database functions, preventing potential manipulation. It is a safe, non-destructive configuration change.]
          
          ## Metadata:
          - Schema-Category: ["Safe", "Security"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Modifies the configuration of the following functions:
            - delete_all_user_data()
            - delete_records_for_date(text)
            - bulk_add_payments_received(jsonb)
            - bulk_add_credit_sales(jsonb)
          
          ## Security Implications:
          - RLS Status: [N/A]
          - Policy Changes: [No]
          - Auth Requirements: [N/A]
          
          ## Performance Impact:
          - Indexes: [N/A]
          - Triggers: [N/A]
          - Estimated Impact: [None]
          */

ALTER FUNCTION public.delete_all_user_data()
SET search_path = public;

ALTER FUNCTION public.delete_records_for_date(record_date text)
SET search_path = public;

ALTER FUNCTION public.bulk_add_payments_received(entries jsonb)
SET search_path = public;

ALTER FUNCTION public.bulk_add_credit_sales(entries jsonb)
SET search_path = public;
