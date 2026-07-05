-- 95_update_morning_reminder_cron.sql

-- 1. Unschedule old 6:00 AM WAT (5:00 AM UTC) morning reminder cron
SELECT cron.unschedule('daily-morning-variant-reminder');

-- 2. Schedule new 7:00 AM WAT (6:00 AM UTC) morning reminder cron
SELECT cron.schedule(
    'daily-morning-variant-reminder',
    '0 6 * * *',
    $$SELECT public.send_daily_reminders_morning()$$
);
