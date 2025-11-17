-- Add the new column to the daily_records table to store the breakdown
ALTER TABLE public.daily_records
ADD COLUMN sales_0332_breakdown jsonb;

-- Re-apply the RLS policy to ensure it covers the new column implicitly
-- This ensures users can only access and modify their own records.
DROP POLICY IF EXISTS "Enable all operations for users based on user_id" ON "public"."daily_records";

CREATE POLICY "Enable all operations for users based on user_id"
ON public.daily_records
AS PERMISSIVE FOR ALL
TO authenticated
USING ((auth.uid() = user_id))
WITH CHECK ((auth.uid() = user_id));
