-- 134_anonymized_telemetry.sql
-- Table and helper functions for anonymized client telemetry collection and daily digests

CREATE TABLE IF NOT EXISTS public.daily_telemetry (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   date DATE NOT NULL,
   client_hash TEXT NOT NULL,
   app_opens INT NOT NULL DEFAULT 1,
   time_spent_seconds INT NOT NULL DEFAULT 0,
   clicks_per_section JSONB NOT NULL DEFAULT '{}'::jsonb,
   time_spent_per_section JSONB NOT NULL DEFAULT '{}'::jsonb,
   is_bounce BOOLEAN NOT NULL DEFAULT false,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_telemetry_date ON public.daily_telemetry (date);
CREATE INDEX IF NOT EXISTS idx_daily_telemetry_client_hash ON public.daily_telemetry (client_hash);

ALTER TABLE public.daily_telemetry ENABLE ROW LEVEL SECURITY;

-- Allow public/anon insertion for anonymous telemetry submission
DROP POLICY IF EXISTS "Allow public insert to daily_telemetry" ON public.daily_telemetry;
CREATE POLICY "Allow public insert to daily_telemetry"
   ON public.daily_telemetry FOR INSERT
   WITH CHECK (true);

-- Allow service role full access
DROP POLICY IF EXISTS "Allow service role full access to daily_telemetry" ON public.daily_telemetry;
CREATE POLICY "Allow service role full access to daily_telemetry"
   ON public.daily_telemetry FOR ALL
   USING (true);

-- RPC for client telemetry submission
CREATE OR REPLACE FUNCTION public.submit_daily_telemetry(
   p_date DATE,
   p_client_hash TEXT,
   p_app_opens INT DEFAULT 1,
   p_time_spent_seconds INT DEFAULT 0,
   p_clicks_per_section JSONB DEFAULT '{}'::jsonb,
   p_time_spent_per_section JSONB DEFAULT '{}'::jsonb,
   p_is_bounce BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
   INSERT INTO public.daily_telemetry (
      date,
      client_hash,
      app_opens,
      time_spent_seconds,
      clicks_per_section,
      time_spent_per_section,
      is_bounce
   ) VALUES (
      p_date,
      p_client_hash,
      GREATEST(1, p_app_opens),
      GREATEST(0, p_time_spent_seconds),
      COALESCE(p_clicks_per_section, '{}'::jsonb),
      COALESCE(p_time_spent_per_section, '{}'::jsonb),
      p_is_bounce
   );
END;
$$;

-- Function for daily telemetry report digest & admin dashboard analytics
CREATE OR REPLACE FUNCTION public.get_daily_telemetry_summary(p_target_date DATE)
RETURNS TABLE (
   target_date DATE,
   total_active_devices INT,
   total_app_opens INT,
   avg_app_opens_per_user NUMERIC,
   total_time_spent_seconds INT,
   avg_time_spent_seconds NUMERIC,
   total_bounces INT,
   bounce_rate_pct NUMERIC,
   top_clicks JSONB,
   top_time_spent JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
   v_active_devices INT;
   v_app_opens INT;
   v_avg_opens NUMERIC;
   v_total_time INT;
   v_avg_time NUMERIC;
   v_bounces INT;
   v_bounce_pct NUMERIC;
   v_top_clicks JSONB;
   v_top_time JSONB;
BEGIN
   SELECT 
      COUNT(DISTINCT client_hash)::int,
      COALESCE(SUM(app_opens), 0)::int,
      ROUND(COALESCE(AVG(app_opens), 0)::numeric, 2),
      COALESCE(SUM(time_spent_seconds), 0)::int,
      ROUND(COALESCE(AVG(time_spent_seconds), 0)::numeric, 1),
      COALESCE(COUNT(*) FILTER (WHERE is_bounce = true), 0)::int,
      CASE 
         WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE is_bounce = true)::numeric / COUNT(*)::numeric) * 100.0, 1)
         ELSE 0.0
      END
   INTO 
      v_active_devices,
      v_app_opens,
      v_avg_opens,
      v_total_time,
      v_avg_time,
      v_bounces,
      v_bounce_pct
   FROM public.daily_telemetry
   WHERE date = p_target_date;

   -- Aggregate top clicks per section
   SELECT COALESCE(
      jsonb_object_agg(section_key, total_clicks),
      '{}'::jsonb
   )
   INTO v_top_clicks
   FROM (
      SELECT key AS section_key, SUM(value::numeric)::int AS total_clicks
      FROM public.daily_telemetry,
           jsonb_each_text(clicks_per_section)
      WHERE date = p_target_date
      GROUP BY key
      ORDER BY total_clicks DESC
      LIMIT 10
   ) sub_clicks;

   -- Aggregate top time spent per section
   SELECT COALESCE(
      jsonb_object_agg(section_key, total_seconds),
      '{}'::jsonb
   )
   INTO v_top_time
   FROM (
      SELECT key AS section_key, SUM(value::numeric)::int AS total_seconds
      FROM public.daily_telemetry,
           jsonb_each_text(time_spent_per_section)
      WHERE date = p_target_date
      GROUP BY key
      ORDER BY total_seconds DESC
      LIMIT 10
   ) sub_time;

   RETURN QUERY SELECT
      p_target_date,
      v_active_devices,
      v_app_opens,
      v_avg_opens,
      v_total_time,
      v_avg_time,
      v_bounces,
      v_bounce_pct,
      v_top_clicks,
      v_top_time;
END;
$$;
