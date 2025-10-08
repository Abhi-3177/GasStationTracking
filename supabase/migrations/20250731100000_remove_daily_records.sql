/*
# [Operation Name]
Drop Daily Records Table

## Query Description: [This operation will permanently delete the "daily_records" table and all data it contains. This action is irreversible and is intended to remove the Daily Record feature from the application entirely. Please ensure you have backed up any necessary data before proceeding.]

## Metadata:
- Schema-Category: "Dangerous"
- Impact-Level: "High"
- Requires-Backup: true
- Reversible: false

## Structure Details:
- Tables Affected: public.daily_records (DROPPED)

## Security Implications:
- RLS Status: N/A
- Policy Changes: No
- Auth Requirements: N/A

## Performance Impact:
- Indexes: Removed with table
- Triggers: N/A
- Estimated Impact: Low, as it removes an unused table.
*/

DROP TABLE IF EXISTS public.daily_records;
