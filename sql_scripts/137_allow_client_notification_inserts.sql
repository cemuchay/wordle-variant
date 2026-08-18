-- 137_allow_client_notification_inserts.sql
-- Securely allow authenticated users to send peer-to-peer game challenge alerts 
-- while strictly blocking spoofing of SYSTEM or ADMIN broadcasts.

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Allow authenticated users to insert game notifications" ON public.notifications;

    CREATE POLICY "Allow authenticated users to insert game notifications" 
    ON public.notifications 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        -- 1. Ensure user is logged in
        auth.uid() IS NOT NULL
        -- 2. Restrict to legitimate peer-to-peer / match notification types only
        AND type IN (
            'CHALLENGE_INVITE',
            'CHALLENGE_STARTED',
            'CHALLENGE_COMPLETED',
            'MARATHON_GAME_COMPLETED'
        )
        -- 3. Explicitly prohibit clients from forging System or Admin announcements
        AND type NOT IN ('SYSTEM', 'ADMIN_BROADCAST')
    );
END $$;
