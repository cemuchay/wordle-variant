-- 51_dm_notifications_and_push_flag.sql

-- 1. Add delivered_via_push column to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivered_via_push BOOLEAN DEFAULT false;

-- 2. Create trigger function to handle notifications for new direct messages
CREATE OR REPLACE FUNCTION public.handle_new_dm_message()
RETURNS TRIGGER AS $$
DECLARE
    group_type TEXT;
    recipient_id UUID;
    sender_username VARCHAR;
    msg_content TEXT;
BEGIN
    -- Get the group type
    SELECT type INTO group_type FROM public.chat_groups WHERE id = NEW.group_id;

    -- Only generate notifications for Direct Messages (DMs)
    IF group_type = 'dm' THEN
        -- Find the other member of the DM group
        SELECT user_id INTO recipient_id
        FROM public.chat_group_members
        WHERE group_id = NEW.group_id AND user_id != NEW.user_id
        LIMIT 1;

        IF recipient_id IS NOT NULL THEN
            -- Get sender username for the message body
            SELECT username INTO sender_username FROM public.profiles WHERE id = NEW.user_id;
            sender_username := COALESCE(sender_username, 'Someone');

            -- Insert the private notification with a generic message for privacy
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                recipient_id,
                'DM_MESSAGE',
                'New Message',
                'You have a new message from ' || sender_username || ', open to see.',
                jsonb_build_object(
                    'group_id', NEW.group_id,
                    'message_id', NEW.id,
                    'sender_id', NEW.user_id
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on messages
DROP TRIGGER IF EXISTS trigger_dm_message_notification ON public.messages;
CREATE TRIGGER trigger_dm_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_dm_message();

-- 4. Overwrite handle_new_notification_push to include notification_id in payload
CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  payload JSON;
BEGIN
  -- Construct the JSON payload for the edge function, including notification_id
  payload := json_build_object(
    'user_id', NEW.user_id,
    'notification_id', NEW.id,
    'title', COALESCE(NEW.title, 'New Notification'),
    'body', COALESCE(NEW.message, 'You have a new update.')
  );

  -- Perform the asynchronous HTTP POST to the send-push Edge Function
  PERFORM net.http_post(
    url := concat(
      COALESCE(
        (SELECT value FROM pg_catalog.pg_settings WHERE name = 'supabase.url'),
        'https://your-project-ref.supabase.co'
      ),
      '/functions/v1/send-push'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1))
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;
