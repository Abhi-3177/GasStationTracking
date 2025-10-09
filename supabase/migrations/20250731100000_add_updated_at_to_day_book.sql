/*
          # [Structural] Add missing updated_at column
          This migration adds the `updated_at` column to the `day_book_records` table. This column was expected by the application but was missing from the database schema, causing save and fetch operations to fail.

          ## Query Description: 
          - Adds a new `updated_at` column of type `timestamp with time zone`.
          - This is a non-destructive operation and is safe to run.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true (by dropping the column)
          
          ## Structure Details:
          - Table: `public.day_book_records`
          - Column Added: `updated_at` (timestamp with time zone)
          
          ## Security Implications:
          - RLS Status: Unchanged
          - Policy Changes: No
          - Auth Requirements: None
          
          ## Performance Impact:
          - Indexes: None added
          - Triggers: None added
          - Estimated Impact: Negligible.
          */

ALTER TABLE public.day_book_records
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
