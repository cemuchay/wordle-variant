-- Update the handle_new_notification_push trigger function to generate target URLs for follows and comments
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
  -- 1. Determine Target URL for deep-linking
  IF NEW.type IN ('CHALLENGE_INVITE', 'CHALLENGE_STARTED', 'CHALLENGE_COMPLETED', 'MARATHON_GAME_COMPLETED') THEN
    IF NEW.data ? 'challenge_id' THEN
      target_url := '/?challenge=' || (NEW.data->>'challenge_id');
    END IF;
  ELSIF NEW.type = 'DM_MESSAGE' THEN
    IF NEW.data ? 'group_id' THEN
      target_url := '/?open=chat&group_id=' || (NEW.data->>'group_id');
    END IF;
  ELSIF NEW.type = 'LEADERBOARD_OVERTAKEN' OR NEW.type = 'NEW_COMMENT' OR NEW.type = 'FOLLOWEE_STARTED_PLAYING' OR NEW.type = 'FOLLOWEE_FINISHED_PLAYING' THEN
    target_url := '/?open=leaderboard';
  ELSIF NEW.type = 'NEW_FOLLOWER' THEN
    IF NEW.data ? 'follower_id' THEN
      target_url := '/?open=profile&user_id=' || (NEW.data->>'follower_id');
    END IF;
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

ALTER FUNCTION public.handle_new_notification_push() OWNER TO postgres;
