/*
# [Schema Correction] Add missing 'record' columns
This migration corrects the schema for `day_book_records` and `daily_records` tables by adding the missing `record` column, which is essential for storing the main data objects.

## Query Description:
This is a safe, non-destructive operation. It adds a new column of type JSONB to the existing tables if it doesn't already exist. No data will be lost or modified.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Adds column `record` (JSONB) to `public.day_book_records`.
- Adds column `record` (JSONB) to `public.daily_records`.

## Security Implications:
- RLS Status: Unchanged.
- Policy Changes: No.
- Auth Requirements: None.

## Performance Impact:
- Indexes: None added.
- Triggers: None added.
- Estimated Impact: Minimal. The operation will be fast on tables with few rows.
*/

ALTER TABLE public.day_book_records
ADD COLUMN IF NOT EXISTS record JSONB;

ALTER TABLE public.daily_records
ADD COLUMN IF NOT EXISTS record JSONB;
