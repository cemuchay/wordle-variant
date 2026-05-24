-- 26_schedule_email_cron.sql
-- Setup pg_cron jobs and a helper Postgres function to trigger email notifications via pg_net

-- 1. Enable required extensions (pg_net and pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the helper function to perform HTTP POST to our email-notifications Edge Function
CREATE OR REPLACE FUNCTION public.trigger_email_notification(action_name TEXT)
RETURNS VOID AS $$
DECLARE
  ef_url TEXT;
  ef_secret TEXT;
  headers_json JSONB;
  body_json JSONB;
BEGIN
  -- Get base Edge Function URL and secret from cache_settings
  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RAISE WARNING 'Cache / system settings not configured. Skipping email trigger.';
    RETURN;
  END IF;

  -- Adapt the redis-cache URL to the email-notifications endpoint
  ef_url := REPLACE(ef_url, 'redis-cache', 'email-notifications');

  headers_json := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', ef_secret
  );

  body_json := jsonb_build_object(
    'action', action_name
  );

  -- Perform the asynchronous HTTP POST request
  PERFORM net.http_post(
    url := ef_url,
    headers := headers_json,
    body := body_json
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Schedule the cron jobs (times in UTC, West Africa Time WAT is UTC+1)

-- A. Daily Morning Reminders (Skipped-a-day & 3-day inactive)
-- Scheduled for 7:00 AM UTC (8:00 AM WAT) every day
SELECT cron.schedule(
    'email-morning-reminders',
    '0 7 * * *',
    $$SELECT public.trigger_email_notification('morning-reminders')$$
);

-- B. Daily Evening Reminders (Streak warnings)
-- Scheduled for 6:00 PM UTC (7:00 PM WAT) every day
SELECT cron.schedule(
    'email-evening-reminders',
    '0 18 * * *',
    $$SELECT public.trigger_email_notification('evening-reminders')$$
);

-- C. Weekly Reports (leaderboard for previous week)
-- Scheduled for 7:00 AM UTC (8:00 AM WAT) every Monday
SELECT cron.schedule(
    'email-weekly-report',
    '0 7 * * 1',
    $$SELECT public.trigger_email_notification('weekly-report')$$
);
