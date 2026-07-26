-- 130_bot_marathon_notifications.sql
-- Notification functions, triggers, and RPCs for Daily Bot Marathon events and Admin custom broadcasts.

-- 1. Helper function: Get active users for Bot Marathon notifications (logged in or active within last 14 days)
CREATE OR REPLACE FUNCTION public.get_active_users_for_bot_marathon()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    email TEXT,
    has_push_sub BOOLEAN,
    receive_emails BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS user_id,
        p.username,
        u.email::text,
        EXISTS(SELECT 1 FROM public.push_subscriptions sub WHERE sub.user_id = p.id) AS has_push_sub,
        COALESCE(ep.receive_emails, true) AS receive_emails
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    LEFT JOIN public.email_preferences ep ON p.id = ep.user_id
    WHERE (
        u.last_sign_in_at >= (now() - interval '14 days')
        OR p.updated_at >= (now() - interval '14 days')
        OR p.last_seen_at >= (now() - interval '14 days')
        OR EXISTS (SELECT 1 FROM public.scores s WHERE s.user_id = p.id AND s.created_at >= (now() - interval '14 days'))
      )
      AND p.id != '00000000-0000-0000-0000-000000000b0b'
      AND u.email NOT LIKE '%@variant.internal';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Helper function: Trigger email notifications with JSON payload
CREATE OR REPLACE FUNCTION public.trigger_email_notification_with_payload(action_name TEXT, payload JSONB DEFAULT '{}'::jsonb)
RETURNS VOID AS $$
DECLARE
  ef_url TEXT;
  ef_secret TEXT;
  headers_json JSONB;
  body_json JSONB;
BEGIN
  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RAISE WARNING 'Cache / system settings not configured. Skipping email trigger with payload.';
    RETURN;
  END IF;

  ef_url := REPLACE(ef_url, 'redis-cache', 'email-notifications');

  headers_json := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', ef_secret
  );

  body_json := payload || jsonb_build_object('action', action_name);

  PERFORM net.http_post(
    url := ef_url,
    headers := headers_json,
    body := body_json
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Trigger: Event 1 - New Bot Marathon Event Created
CREATE OR REPLACE FUNCTION public.handle_new_bot_marathon_created()
RETURNS TRIGGER AS $$
DECLARE
    u RECORD;
BEGIN
    IF COALESCE(NEW.is_bot_marathon, false) = true THEN
        -- Insert in-app notification for ALL active users (which automatically triggers web push for those with push subscriptions)
        FOR u IN SELECT * FROM public.get_active_users_for_bot_marathon() LOOP
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                u.user_id,
                'BOT_MARATHON_NEW',
                '🤖 New Bot Marathon Challenge!',
                'A new Daily Bot Marathon event is live! Test your word skills against Variant Bot today.',
                jsonb_build_object('challenge_id', NEW.id)
            );
        END LOOP;

        -- Dispatch email for active users without push subscription
        PERFORM public.trigger_email_notification_with_payload(
            'bot-marathon-new-event',
            jsonb_build_object('challenge_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_bot_marathon_created ON public.challenges;
CREATE TRIGGER trigger_on_bot_marathon_created
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_bot_marathon_created();


-- 4. Trigger: Event 2 - Leaderboard Overtaken in Bot Marathon
CREATE OR REPLACE FUNCTION public.handle_bot_marathon_overtaken()
RETURNS TRIGGER AS $$
DECLARE
    ch_is_bot BOOLEAN;
    new_user_name TEXT;
    overtaken_user RECORD;
    new_user_score INT;
BEGIN
    -- Only act on completed status with valid score
    IF NEW.status != 'completed' OR NEW.user_id IS NULL OR NEW.score IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT is_bot_marathon INTO ch_is_bot
    FROM public.challenges
    WHERE id = NEW.challenge_id;

    IF NOT COALESCE(ch_is_bot, false) THEN
        RETURN NEW;
    END IF;

    -- Get username of the player who just completed/scored
    SELECT username INTO new_user_name FROM public.profiles WHERE id = NEW.user_id;
    new_user_name := COALESCE(new_user_name, 'A player');
    new_user_score := NEW.score;

    -- Find participants in the same challenge who had a score lower than new_user_score
    FOR overtaken_user IN (
        SELECT cp.user_id, cp.score, p.username,
               EXISTS(SELECT 1 FROM public.push_subscriptions sub WHERE sub.user_id = cp.user_id) AS has_push,
               COALESCE(ep.receive_emails, true) AS receive_emails,
               u.email::text AS email
        FROM public.challenge_participants cp
        JOIN public.profiles p ON cp.user_id = p.id
        JOIN auth.users u ON cp.user_id = u.id
        LEFT JOIN public.email_preferences ep ON cp.user_id = ep.user_id
        WHERE cp.challenge_id = NEW.challenge_id
          AND cp.user_id != NEW.user_id
          AND cp.status = 'completed'
          AND cp.score < new_user_score
          AND p.id != '00000000-0000-0000-0000-000000000b0b'
          AND u.email NOT LIKE '%@variant.internal'
    ) LOOP
        -- Insert in-app notification for overtaken user
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            overtaken_user.user_id,
            'BOT_MARATHON_OVERTAKEN',
            '⚠️ You''ve Been Passed!',
            new_user_name || ' has passed you in the Daily Bot Marathon Event! Rejoin now to reclaim your position.',
            jsonb_build_object('challenge_id', NEW.challenge_id, 'surpassed_by', new_user_name)
        );

        -- Send email if user has no push subscription
        IF NOT overtaken_user.has_push AND overtaken_user.receive_emails THEN
            PERFORM public.trigger_email_notification_with_payload(
                'bot-marathon-overtaken',
                jsonb_build_object(
                    'challenge_id', NEW.challenge_id,
                    'user_id', overtaken_user.user_id,
                    'username', overtaken_user.username,
                    'email', overtaken_user.email,
                    'surpassed_by', new_user_name
                )
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_bot_marathon_overtaken ON public.challenge_participants;
CREATE TRIGGER trigger_on_bot_marathon_overtaken
    AFTER UPDATE OF score, status ON public.challenge_participants
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION public.handle_bot_marathon_overtaken();


-- 5. Helper Function: Event 3 - 24-Hour Grand Finale Reminders
CREATE OR REPLACE FUNCTION public.send_bot_marathon_finale_reminders()
RETURNS VOID AS $$
DECLARE
    ch RECORD;
    part RECORD;
BEGIN
    -- Find Bot Marathon challenges ending within the next 24 hours (between 23 and 25 hours from now)
    FOR ch IN (
        SELECT id, created_at, expires_at
        FROM public.challenges
        WHERE is_bot_marathon = true
          AND expires_at IS NOT NULL
          AND expires_at >= (now() + interval '23 hours')
          AND expires_at <= (now() + interval '25 hours')
    ) LOOP
        FOR part IN (
            SELECT cp.user_id, p.username, u.email::text,
                   EXISTS(SELECT 1 FROM public.push_subscriptions sub WHERE sub.user_id = cp.user_id) AS has_push,
                   COALESCE(ep.receive_emails, true) AS receive_emails
            FROM public.challenge_participants cp
            JOIN public.profiles p ON cp.user_id = p.id
            JOIN auth.users u ON cp.user_id = u.id
            LEFT JOIN public.email_preferences ep ON cp.user_id = ep.user_id
            WHERE cp.challenge_id = ch.id
              AND p.id != '00000000-0000-0000-0000-000000000b0b'
              AND u.email NOT LIKE '%@variant.internal'
        ) LOOP
            -- In-App + Push notification
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                part.user_id,
                'BOT_MARATHON_FINALE',
                '🔥 Grand Finale Approaching!',
                'Only 24 hours left in the Daily Bot Marathon Event! Finish your remaining rounds before time runs out.',
                jsonb_build_object('challenge_id', ch.id)
            );

            -- Email notification for users without push subscription
            IF NOT part.has_push AND part.receive_emails THEN
                PERFORM public.trigger_email_notification_with_payload(
                    'bot-marathon-grand-finale',
                    jsonb_build_object(
                        'challenge_id', ch.id,
                        'user_id', part.user_id,
                        'username', part.username,
                        'email', part.email
                    )
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule Finale Reminder daily at 10:00 AM UTC (11:00 AM WAT)
SELECT cron.schedule(
    'bot-marathon-finale-reminder',
    '0 10 * * *',
    $$SELECT public.send_bot_marathon_finale_reminders()$$
);


-- 6. RPC Function: Admin Custom Notification Broadcaster
CREATE OR REPLACE FUNCTION public.send_admin_custom_notification(
    p_title TEXT,
    p_message TEXT,
    p_url TEXT DEFAULT '/',
    p_delivery_mode TEXT DEFAULT 'hybrid', -- 'hybrid', 'push_only', 'email_only', 'in_app_only'
    p_target_audience TEXT DEFAULT 'active', -- 'active', 'all', 'participants', 'user'
    p_target_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sent_count INT := 0;
    v_push_count INT := 0;
    v_email_count INT := 0;
    u RECORD;
BEGIN
    -- 1. Security Check: Admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only admin users can broadcast custom notifications.';
    END IF;

    -- 2. Gather Target Audience Users
    FOR u IN (
        SELECT 
            p.id AS user_id,
            p.username,
            usr.email::text AS email,
            EXISTS(SELECT 1 FROM public.push_subscriptions sub WHERE sub.user_id = p.id) AS has_push,
            COALESCE(ep.receive_emails, true) AS receive_emails
        FROM public.profiles p
        JOIN auth.users usr ON p.id = usr.id
        LEFT JOIN public.email_preferences ep ON p.id = ep.user_id
        WHERE p.id != '00000000-0000-0000-0000-000000000b0b'
          AND usr.email NOT LIKE '%@variant.internal'
          AND (
            (p_target_audience = 'user' AND p.id = p_target_user_id) OR
            (p_target_audience = 'all') OR
            (p_target_audience = 'active' AND (
                usr.last_sign_in_at >= (now() - interval '14 days')
                OR p.updated_at >= (now() - interval '14 days')
                OR p.last_seen_at >= (now() - interval '14 days')
                OR EXISTS (SELECT 1 FROM public.scores s WHERE s.user_id = p.id AND s.created_at >= (now() - interval '14 days'))
            )) OR
            (p_target_audience = 'participants' AND EXISTS(SELECT 1 FROM public.challenge_participants cp JOIN public.challenges ch ON cp.challenge_id = ch.id WHERE cp.user_id = p.id AND ch.is_bot_marathon = true))
          )
    ) LOOP
        v_sent_count := v_sent_count + 1;

        -- Mode: In-App Notification (Always inserted for EVERY user in the target audience)
        IF p_delivery_mode IN ('hybrid', 'push_only', 'email_only', 'in_app_only') THEN
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                u.user_id,
                'ADMIN_BROADCAST',
                p_title,
                p_message,
                jsonb_build_object('url', p_url, 'action_url', p_url)
            );
        END IF;

        IF u.has_push THEN
            v_push_count := v_push_count + 1;
        END IF;

        -- Email Dispatch Logic (Sent if email_only, OR if hybrid & user lacks push sub & has not opted out)
        IF (p_delivery_mode = 'email_only' AND u.receive_emails) OR
           (p_delivery_mode = 'hybrid' AND NOT u.has_push AND u.receive_emails) THEN
            v_email_count := v_email_count + 1;
            
            PERFORM public.trigger_email_notification_with_payload(
                'admin-custom-broadcast',
                jsonb_build_object(
                    'user_id', u.user_id,
                    'username', u.username,
                    'email', u.email,
                    'title', p_title,
                    'message', p_message,
                    'url', p_url
                )
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total_recipients', v_sent_count,
        'push_users', v_push_count,
        'email_sent', v_email_count,
        'delivery_mode', p_delivery_mode,
        'target_audience', p_target_audience
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.send_admin_custom_notification(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
