-- 136_enhanced_lifecycle_telemetry.sql
-- Upgrades public.daily_telemetry with rich lifecycle analytics, attribution, and ghost detection
-- Fully backward-compatible: existing columns remain unchanged and all new fields default safely.

ALTER TABLE public.daily_telemetry
   ADD COLUMN IF NOT EXISTS daily_completed BOOLEAN NOT NULL DEFAULT false,
   ADD COLUMN IF NOT EXISTS opens_before_completion INT NOT NULL DEFAULT 1,
   ADD COLUMN IF NOT EXISTS opens_after_completion INT NOT NULL DEFAULT 0,
   ADD COLUMN IF NOT EXISTS opened_via_notification BOOLEAN NOT NULL DEFAULT false,
   ADD COLUMN IF NOT EXISTS notification_opens_count INT NOT NULL DEFAULT 0,
   ADD COLUMN IF NOT EXISTS games_completed JSONB NOT NULL DEFAULT '{"main_daily": 0, "wordup": 0, "challenge": 0, "marathon": 0}'::jsonb,
   ADD COLUMN IF NOT EXISTS is_ghost_suspect BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_daily_telemetry_daily_completed ON public.daily_telemetry (daily_completed);
CREATE INDEX IF NOT EXISTS idx_daily_telemetry_ghost ON public.daily_telemetry (is_ghost_suspect);
CREATE INDEX IF NOT EXISTS idx_daily_telemetry_notification ON public.daily_telemetry (opened_via_notification);

-- Upgraded RPC for client telemetry submission
CREATE OR REPLACE FUNCTION public.submit_daily_telemetry(
   p_date DATE,
   p_client_hash TEXT,
   p_app_opens INT DEFAULT 1,
   p_time_spent_seconds INT DEFAULT 0,
   p_clicks_per_section JSONB DEFAULT '{}'::jsonb,
   p_time_spent_per_section JSONB DEFAULT '{}'::jsonb,
   p_is_bounce BOOLEAN DEFAULT false,
   p_daily_completed BOOLEAN DEFAULT false,
   p_opens_before_completion INT DEFAULT 1,
   p_opens_after_completion INT DEFAULT 0,
   p_opened_via_notification BOOLEAN DEFAULT false,
   p_notification_opens_count INT DEFAULT 0,
   p_games_completed JSONB DEFAULT '{"main_daily": 0, "wordup": 0, "challenge": 0, "marathon": 0}'::jsonb,
   p_is_ghost_suspect BOOLEAN DEFAULT false
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
      is_bounce,
      daily_completed,
      opens_before_completion,
      opens_after_completion,
      opened_via_notification,
      notification_opens_count,
      games_completed,
      is_ghost_suspect
   ) VALUES (
      p_date,
      p_client_hash,
      GREATEST(1, p_app_opens),
      GREATEST(0, p_time_spent_seconds),
      COALESCE(p_clicks_per_section, '{}'::jsonb),
      COALESCE(p_time_spent_per_section, '{}'::jsonb),
      COALESCE(p_is_bounce, false),
      COALESCE(p_daily_completed, false),
      GREATEST(0, COALESCE(p_opens_before_completion, 1)),
      GREATEST(0, COALESCE(p_opens_after_completion, 0)),
      COALESCE(p_opened_via_notification, false),
      GREATEST(0, COALESCE(p_notification_opens_count, 0)),
      COALESCE(p_games_completed, '{"main_daily": 0, "wordup": 0, "challenge": 0, "marathon": 0}'::jsonb),
      COALESCE(p_is_ghost_suspect, false)
   );
END;
$$;
