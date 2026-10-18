-- 147_enhance_admin_broadcast_delivery_modes.sql
-- Adds support for 'email_pure' (email only, no in-app) and 'push_pure' (push only, no in-app)
-- Fixes robust edge_function_url fallback for trigger_email_notification_with_payload

-- 1. Update trigger_email_notification_with_payload to handle robust URL construction
CREATE OR REPLACE FUNCTION public.trigger_email_notification_with_payload(action_name TEXT, payload JSONB DEFAULT '{}'::jsonb)
RETURNS VOID AS $$
DECLARE
  ef_url TEXT;
  ef_secret TEXT;
  base_url TEXT;
  headers_json JSONB;
  body_json JSONB;
BEGIN
  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RAISE WARNING 'Cache / system settings not configured. Skipping email trigger with payload.';
    RETURN;
  END IF;

  base_url := substring(ef_url from '(^.*/functions/v1/)');
  IF base_url IS NOT NULL THEN
     ef_url := base_url || 'email-notifications';
  ELSE
     ef_url := REPLACE(REPLACE(ef_url, 'redis-cache', 'email-notifications'), 'send-push', 'email-notifications');
  END IF;

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


-- 2. Enhanced send_admin_custom_notification RPC
CREATE OR REPLACE FUNCTION public.send_admin_custom_notification(
    p_title TEXT,
    p_message TEXT,
    p_url TEXT DEFAULT '/',
    p_delivery_mode TEXT DEFAULT 'hybrid', -- 'hybrid', 'push_only', 'email_only', 'in_app_only', 'push_pure', 'email_pure'
    p_target_audience TEXT DEFAULT 'active', -- 'active', 'all', 'participants', 'user'
    p_target_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sent_count INT := 0;
    v_push_count INT := 0;
    v_email_count INT := 0;
    ef_url TEXT;
    ef_secret TEXT;
    base_url TEXT;
    u RECORD;
BEGIN
    -- Security Check: Admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only admin users can broadcast custom notifications.';
    END IF;

    -- Pre-calculate push URL & secret if push_pure is used
    IF p_delivery_mode = 'push_pure' THEN
        SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
        SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';
        IF ef_url IS NOT NULL THEN
            base_url := substring(ef_url from '(^.*/functions/v1/)');
            IF base_url IS NOT NULL THEN
                ef_url := base_url || 'send-push';
            ELSE
                ef_url := REPLACE(REPLACE(ef_url, 'redis-cache', 'send-push'), 'email-notifications', 'send-push');
            END IF;
        END IF;
    END IF;

    -- Gather Target Audience Users
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

        -- 1. In-App Notification (Inserted for hybrid, push_only, email_only, in_app_only; SKIPPED for push_pure and email_pure)
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

        -- 2. Push Accounting & Direct Push Trigger for push_pure
        IF u.has_push THEN
            v_push_count := v_push_count + 1;

            -- If push_pure, we bypass in-app notifications and trigger send-push directly
            IF p_delivery_mode = 'push_pure' AND ef_url IS NOT NULL AND ef_secret IS NOT NULL THEN
                PERFORM net.http_post(
                    url := ef_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'x-internal-secret', ef_secret
                    ),
                    body := jsonb_build_object(
                        'user_id', u.user_id,
                        'title', p_title,
                        'body', p_message,
                        'url', p_url
                    )
                );
            END IF;
        END IF;

        -- 3. Email Dispatch Logic
        IF (p_delivery_mode IN ('email_only', 'email_pure') AND u.receive_emails) OR
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
