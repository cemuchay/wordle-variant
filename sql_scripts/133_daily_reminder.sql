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
      -- Store raw peak play hour in UTC
      MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC'))::int AS target_hour
    FROM public.scores
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND user_id IS NOT NULL
    GROUP BY user_id
  ) sub
  WHERE p.id = sub.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_personalized_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Calculate target preferred hour (Current UTC Hour - 2 hours)
  v_target_hour SMALLINT := (EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::int + 22) % 24;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT DISTINCT sub.user_id, 
         'SYSTEM', 
         'Word of the Day is Ready?', 
         'You usually play around this time! It''s past your start time and you haven''t played today''s word yet.', 
         jsonb_build_object('type', 'daily_reminder_nudge')
  FROM public.push_subscriptions sub
  JOIN public.profiles p ON p.id = sub.user_id
  -- Match users whose peak play hour was 2 hours ago
  WHERE p.preferred_reminder_hour_utc = v_target_hour
    -- Exclude users who already started/completed today
    AND NOT EXISTS (
        SELECT 1 
        FROM public.scores sc
        WHERE sc.user_id = sub.user_id 
          AND sc.game_date = (timezone('Africa/Lagos', now()))::date
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.send_late_catchall_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT DISTINCT sub.user_id,
         'SYSTEM',
         'Don''t break your streak!',
         CASE 
           WHEN sc.id IS NOT NULL AND sc.status = 'playing' 
             THEN 'You started today''s puzzle! Finish it up before time runs out.'
           ELSE 'Today''s word is waiting for you! Jump in before the day ends.'
         END AS message,
         jsonb_build_object('type', 'daily_catchall_reminder')
  FROM public.push_subscriptions sub
  LEFT JOIN public.scores sc 
    ON sc.user_id = sub.user_id 
   AND sc.game_date = (timezone('Africa/Lagos', now()))::date
  -- Include users who haven't played OR are still in status 'playing'
  WHERE (sc.id IS NULL OR sc.status = 'playing');
END;
$$;