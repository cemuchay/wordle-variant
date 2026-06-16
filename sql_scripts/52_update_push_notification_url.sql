-- 52_update_push_notification_url.sql

-- Update the handle_new_notification_push trigger function to generate target URLs
CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  payload JSONB;
  target_url TEXT := '/';
BEGIN
  -- Determine URL based on notification type and data
  IF NEW.type IN ('CHALLENGE_INVITE', 'CHALLENGE_STARTED', 'CHALLENGE_COMPLETED', 'MARATHON_GAME_COMPLETED') THEN
    IF NEW.data ? 'challenge_id' THEN
      target_url := '/?challenge=' || (NEW.data->>'challenge_id');
    END IF;
  ELSIF NEW.type = 'DM_MESSAGE' THEN
    IF NEW.data ? 'group_id' THEN
      target_url := '/?open=chat&group_id=' || (NEW.data->>'group_id');
    END IF;
  ELSIF NEW.type = 'LEADERBOARD_OVERTAKEN' THEN
    target_url := '/?open=leaderboard';
  END IF;

  -- Construct the JSON payload for the edge function, including notification_id and url
  payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'notification_id', NEW.id,
    'title', COALESCE(NEW.title, 'New Notification'),
    'body', COALESCE(NEW.message, 'You have a new update.'),
    'url', target_url
  );

  -- Perform the asynchronous HTTP POST to the send-push Edge Function
  PERFORM net.http_post(
    url := concat(
      COALESCE(
        current_setting('supabase.url', true),
        'https://your-project-ref.supabase.co'
      ),
      '/functions/v1/send-push'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets where name = 'service_role_key' limit 1))
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;
