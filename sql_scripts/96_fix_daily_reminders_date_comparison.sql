-- 96_fix_daily_reminders_date_comparison.sql

-- 1. Fix morning reminder date comparison operator mismatch
CREATE OR REPLACE FUNCTION public.send_daily_reminders_morning()
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT DISTINCT sub.user_id, 'SYSTEM', 'Daily Variant Reminder', 'Good morning, Variant Word of the Day is ready, play now to get started!', jsonb_build_object('type', 'daily_reminder')
    FROM public.push_subscriptions sub
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.scores sc
        WHERE sc.user_id = sub.user_id 
          AND sc.game_date = (timezone('Africa/Lagos', now()))::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix afternoon reminder date comparison operator mismatch
CREATE OR REPLACE FUNCTION public.send_daily_reminders_afternoon()
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT DISTINCT sub.user_id, 'SYSTEM', 'Daily Variant Reminder', 'Don''t forget to finish your daily Variant game!', jsonb_build_object('type', 'daily_reminder')
    FROM public.push_subscriptions sub
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.scores sc
        WHERE sc.user_id = sub.user_id 
          AND sc.game_date = (timezone('Africa/Lagos', now()))::date
          AND sc.status IN ('won', 'lost')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
