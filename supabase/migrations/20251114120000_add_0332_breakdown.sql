ALTER TABLE public.daily_records
ADD COLUMN IF NOT EXISTS sales_0332_breakdown jsonb;

-- Re-apply RLS policies to ensure they are correct
DROP POLICY IF EXISTS "Users can view their own daily records." ON public.daily_records;
CREATE POLICY "Users can view their own daily records."
ON public.daily_records FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own daily records." ON public.daily_records;
CREATE POLICY "Users can insert their own daily records."
ON public.daily_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own daily records." ON public.daily_records;
CREATE POLICY "Users can update their own daily records."
ON public.daily_records FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own daily records." ON public.daily_records;
CREATE POLICY "Users can delete their own daily records."
ON public.daily_records FOR DELETE
USING (auth.uid() = user_id);
