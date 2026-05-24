-- 23_notification_expiration.sql
-- Automate deletion of notifications older than 30 days using pg_cron

-- 1. Enable pg_cron if it is available and not enabled yet
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule a daily cron job to purge notifications older than 30 days
SELECT cron.schedule(
    'purge-old-notifications',
    '0 0 * * *', -- Everyday at midnight UTC
    $$DELETE FROM public.notifications WHERE created_at < now() - INTERVAL '30 days'$$
);
