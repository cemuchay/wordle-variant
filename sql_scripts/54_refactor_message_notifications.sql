-- 54_refactor_message_notifications.sql
-- Refactor message notifications to avoid spamming real-time push notifications.
-- Consolidates DM and Chat mentions into a daily summary at 8:00 AM WAT.

-- 1. Update the handle_new_notification_push trigger function to skip real-time pushes for messages
CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, net
LANGUAGE plpgsql
AS $$
DECLARE
  payload JSONB;
  target_url TEXT := '/';
  ef_url TEXT;
  ef_secret TEXT;
  base_url TEXT;
BEGIN
  -- SKIP real-time push for message notifications to avoid being flagged as spam by Chrome
  IF NEW.type IN ('DM_MESSAGE', 'CHAT_MENTION') THEN
    RETURN NEW;
  END IF;

  -- 1. Determine Target URL for deep-linking
  IF NEW.type IN ('CHALLENGE_INVITE', 'CHALLENGE_STARTED', 'CHALLENGE_COMPLETED', 'MARATHON_GAME_COMPLETED') THEN
    IF NEW.data ? 'challenge_id' THEN
      target_url := '/?challenge=' || (NEW.data->>'challenge_id');
    END IF;
  ELSIF NEW.type = 'LEADERBOARD_OVERTAKEN' THEN
    target_url := '/?open=leaderboard';
  END IF;

  -- 2. Construct Payload
  payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'notification_id', NEW.id,
    'title', COALESCE(NEW.title, 'New Notification'),
    'body', COALESCE(NEW.message, 'You have a new update.'),
    'url', target_url
  );

  -- 3. Fetch Configuration (Standard Project Pattern)
  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RETURN NEW;
  END IF;

  -- 4. Robust URL Construction
  base_url := substring(ef_url from '(^.*/functions/v1/)');
  IF base_url IS NOT NULL THEN
     ef_url := base_url || 'send-push';
  ELSE
     ef_url := REPLACE(REPLACE(ef_url, 'redis-cache', 'send-push'), 'email-notifications', 'send-push');
  END IF;

  -- 5. Perform the asynchronous HTTP POST
  PERFORM net.http_post(
    url := ef_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', ef_secret
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- 2. Create a helper function to trigger the daily message summary push
CREATE OR REPLACE FUNCTION public.trigger_daily_message_summary_push()
RETURNS VOID AS $$
DECLARE
  ef_url TEXT;
  ef_secret TEXT;
  base_url TEXT;
  rec RECORD;
BEGIN
  -- 1. Fetch Configuration
  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RETURN;
  END IF;

  -- 2. Construct Edge Function URL
  base_url := substring(ef_url from '(^.*/functions/v1/)');
  IF base_url IS NOT NULL THEN
     ef_url := base_url || 'send-push';
  ELSE
     ef_url := REPLACE(REPLACE(ef_url, 'redis-cache', 'send-push'), 'email-notifications', 'send-push');
  END IF;

  -- 3. Find users with unread message notifications from the last 12 hours
  FOR rec IN (
    SELECT n.user_id, count(*) as unread_count
    FROM public.notifications n
    WHERE n.is_read = false 
      AND n.type IN ('DM_MESSAGE', 'CHAT_MENTION')
      AND n.created_at > now() - interval '12 hours'
    GROUP BY n.user_id
  ) LOOP
    -- 4. Send a consolidated summary push notification
    PERFORM net.http_post(
      url := ef_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', ef_secret
      ),
      body := jsonb_build_object(
        'user_id', rec.user_id,
        'title', 'Unread Messages',
        'body', 'You have ' || rec.unread_count || ' unread message' || (CASE WHEN rec.unread_count > 1 THEN 's' ELSE '' END) || ' from the last 12 hours. Open Variant to see.',
        'url', '/?open=chat'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule the cron job for 8:00 AM WAT (7:00 AM UTC)
-- Note: '0 7 * * *' is 7:00 AM UTC.
SELECT cron.schedule(
    'message-summary-push',
    '0 7 * * *',
    $$SELECT public.trigger_daily_message_summary_push()$$
);
