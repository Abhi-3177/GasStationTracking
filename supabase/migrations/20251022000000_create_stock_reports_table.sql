/*
          # [Operation Name]
          Create stock_reports Table

          ## Query Description: [This operation creates a new table named 'stock_reports' to store the results of generated stock reports. This change is non-destructive and adds new functionality for persistent, stateful stock reporting.]

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true

          ## Structure Details:
          - Table: public.stock_reports
          - Columns: id, user_id, start_date, end_date, opening_stock_petrol, opening_stock_diesel, closing_stock_petrol, closing_stock_diesel, opening_readings_petrol, opening_readings_diesel, closing_readings_petrol, closing_readings_diesel, report_data, created_at

          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (New policies for SELECT, INSERT, UPDATE, DELETE)
          - Auth Requirements: User must be authenticated.

          ## Performance Impact:
          - Indexes: Primary key on 'id', Foreign key on 'user_id'.
          - Triggers: None
          - Estimated Impact: Low.
          */

CREATE TABLE public.stock_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    opening_stock_petrol double precision NOT NULL,
    opening_stock_diesel double precision NOT NULL,
    closing_stock_petrol double precision NOT NULL,
    closing_stock_diesel double precision NOT NULL,
    opening_readings_petrol double precision[] NOT NULL,
    opening_readings_diesel double precision[] NOT NULL,
    closing_readings_petrol double precision[] NOT NULL,
    closing_readings_diesel double precision[] NOT NULL,
    report_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stock_reports OWNER TO postgres;

ALTER TABLE ONLY public.stock_reports
    ADD CONSTRAINT stock_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_reports
    ADD CONSTRAINT stock_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.stock_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.stock_reports FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
