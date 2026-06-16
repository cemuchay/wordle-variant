-- 56_purge_stale_push_subscriptions.sql
-- This script sets up a scheduled job to delete push subscriptions not seen in 30 days.

-- 1. Create the purge function
CREATE OR REPLACE FUNCTION public.purge_stale_push_subscriptions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.push_subscriptions
    WHERE last_seen_at < (now() - INTERVAL '30 days');
    
    RAISE LOG 'Purged stale push subscriptions at %', now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Schedule the job using pg_cron (if available in your Supabase project)
-- Note: You may need to enable pg_cron in the Supabase Dashboard under Extensions.
SELECT
  cron.schedule(
    'purge-stale-push-subs', -- name of the job
    '0 0 * * *',             -- every day at midnight
    $$ SELECT public.purge_stale_push_subscriptions(); $$
  );
