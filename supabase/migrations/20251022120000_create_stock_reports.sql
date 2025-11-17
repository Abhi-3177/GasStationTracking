/*
  # [Operation] Create Stock Reports Table
  [This migration creates a new table `stock_reports` to store historical stock reconciliation data. This enables tracking stock levels and readings over time, allowing closing values from one report to become the opening values for the next.]

  ## Query Description: [This is a non-destructive operation that adds a new table. It has no impact on existing data.]
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true (by dropping the table)
  
  ## Structure Details:
  - Table: public.stock_reports
  - Columns: id, user_id, start_date, end_date, opening_stock_petrol, opening_stock_diesel, closing_stock_petrol, closing_stock_diesel, opening_readings_petrol, opening_readings_diesel, closing_readings_petrol, closing_readings_diesel, report_data, created_at
  
  ## Security Implications:
  - RLS Status: Enabled
  - Policy Changes: Yes (new policies are added for this table)
  - Auth Requirements: User must be authenticated to access their own reports.
  
  ## Performance Impact:
  - Indexes: Primary key on `id`, Foreign key on `user_id`. An index on `(user_id, end_date)` is added for efficient lookup of the latest report.
  - Triggers: None
  - Estimated Impact: Low.
*/

-- 1. Create stock_reports table
create table public.stock_reports (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  start_date date not null,
  end_date date not null,
  opening_stock_petrol numeric not null default 0,
  opening_stock_diesel numeric not null default 0,
  closing_stock_petrol numeric not null default 0,
  closing_stock_diesel numeric not null default 0,
  opening_readings_petrol jsonb,
  opening_readings_diesel jsonb,
  closing_readings_petrol jsonb,
  closing_readings_diesel jsonb,
  report_data jsonb,
  created_at timestamp with time zone not null default now(),
  constraint stock_reports_pkey primary key (id),
  constraint stock_reports_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- 2. Add comments to the table and columns
comment on table public.stock_reports is 'Stores historical stock reconciliation reports.';
comment on column public.stock_reports.opening_stock_petrol is 'Opening stock of petrol in litres at the start of the period.';
comment on column public.stock_reports.closing_stock_petrol is 'Closing stock of petrol in litres at the end of the period.';
comment on column public.stock_reports.opening_readings_petrol is 'Array of opening readings for petrol machines.';
comment on column public.stock_reports.report_data is 'JSON object containing the calculated results of the report.';

-- 3. Enable RLS
alter table public.stock_reports enable row level security;

-- 4. Create RLS policies
create policy "Users can view their own stock reports."
on public.stock_reports for select
using (auth.uid() = user_id);

create policy "Users can insert their own stock reports."
on public.stock_reports for insert
with check (auth.uid() = user_id);

create policy "Users can update their own stock reports."
on public.stock_reports for update
using (auth.uid() = user_id);

create policy "Users can delete their own stock reports."
on public.stock_reports for delete
using (auth.uid() = user_id);

-- 5. Create an index for faster lookups of the latest report
create index idx_stock_reports_user_end_date on public.stock_reports(user_id, end_date desc);
