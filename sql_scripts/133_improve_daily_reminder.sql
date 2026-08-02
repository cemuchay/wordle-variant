CREATE INDEX IF NOT EXISTS idx_scores_created_at 
ON public.scores (created_at);

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_reminder_hour_utc SMALLINT DEFAULT 18;

CREATE INDEX IF NOT EXISTS idx_profiles_reminder_hour 
ON public.profiles (preferred_reminder_hour_utc);

-- 1. Main Hourly Reminder Function
CREATE OR REPLACE FUNCTION public.send_personalized_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT DISTINCT sub.user_id, 
         'SYSTEM', 
         'Daily Variant Reminder', 
         'Variant Word of the Day is ready, play now to get started!', 
         jsonb_build_object('type', 'daily_reminder')
  FROM public.push_subscriptions sub
  JOIN public.profiles p ON p.id = sub.user_id
  WHERE p.preferred_reminder_hour_utc = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::smallint
    AND NOT EXISTS (
        SELECT 1 
        FROM public.scores sc
        WHERE sc.user_id = sub.user_id 
          AND sc.game_date = (timezone('Africa/Lagos', now()))::date
    );
END;
$$;

-- 2. Nightly Sync Function
CREATE OR REPLACE FUNCTION public.sync_user_reminder_preferences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles p
  SET preferred_reminder_hour_utc = sub.target_hour
  FROM (
    SELECT 
      user_id,
      (MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC'))::int + 23) % 24 AS target_hour
    FROM public.scores
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND user_id IS NOT NULL
    GROUP BY user_id
  ) sub
  WHERE p.id = sub.user_id;
END;
$$;

-- Drop old functions
DROP FUNCTION IF EXISTS public.send_daily_reminders_morning();
DROP FUNCTION IF EXISTS public.send_daily_reminders_afternoon();

-- Remove old crons (replace names with your exact job names from cron.job)
SELECT cron.unschedule('daily-morning-variant-reminder');
SELECT cron.unschedule('daily-afternoon-variant-reminder');

-- 1. Hourly Dispatch Cron
SELECT cron.schedule(
  'dispatch-hourly-reminders',
  '0 * * * *',
  $$ SELECT public.send_personalized_daily_reminders(); $$
);

-- 2. Nightly Preferences Calculation Cron
SELECT cron.schedule(
  'nightly-sync-reminder-preferences',
  '0 0 * * *',
  $$ SELECT public.sync_user_reminder_preferences(); $$
);