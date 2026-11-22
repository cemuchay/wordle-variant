-- 20261122113500_wordup_topic_response_telemetry.sql
-- Mirror of sql_scripts/150_wordup_topic_response_telemetry.sql for Supabase CLI migrations

CREATE TABLE IF NOT EXISTS public.wordup_topic_telemetry (
    category VARCHAR(50) PRIMARY KEY,
    sample_count INTEGER NOT NULL DEFAULT 0,
    avg_time_taken NUMERIC(5,2) NOT NULL DEFAULT 2.20,
    p25_time_taken NUMERIC(5,2) NOT NULL DEFAULT 1.35,
    median_time_taken NUMERIC(5,2) NOT NULL DEFAULT 2.05,
    p75_time_taken NUMERIC(5,2) NOT NULL DEFAULT 2.95,
    avg_accuracy NUMERIC(4,3) NOT NULL DEFAULT 0.760,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wordup_topic_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Topic telemetry viewable by everyone" ON public.wordup_topic_telemetry;
CREATE POLICY "Topic telemetry viewable by everyone"
ON public.wordup_topic_telemetry FOR SELECT
TO anon, authenticated
USING (true);

