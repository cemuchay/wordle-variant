-- Enable pg_cron and pg_net extensions if not already active
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the sync function to run hourly (at minute 0 of every hour)
-- Replace the URL with your actual supabase project URL if different,
-- and substitute your real SERVICE_ROLE_KEY or INTERNAL_SECRET in the header.
SELECT cron.schedule(
    'sync-otdb-trivia-hourly',
    '0 * * * *', -- hourly schedule cron syntax
    $$ 
    SELECT net.http_post(
        url:='https://fhunogyceifqprpcosdg.supabase.co/functions/v1/sync-otdb-trivia',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
        ),
        body:= '{}'::jsonb
    ) 
    $$
);

-- Note: You can view cron execution status using:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
