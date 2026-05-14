-- Safe Realtime Configuration
-- This script ensures all necessary tables are in the realtime publication
-- without causing "already exists" errors.

-- 1. Ensure the publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add tables to the publication safely
-- This command REPLACES the current list of tables in the publication
-- ensuring a clean state for all features (Chat, Challenges, Profiles).
ALTER PUBLICATION supabase_realtime SET TABLE 
    public.challenges, 
    public.challenge_participants, 
    public.messages, 
    public.profiles,
    public.scores;

-- 3. Ensure REPLICA IDENTITY is set to FULL for tables where we need to track 
-- specific changes or deletions (like participants or messages)
ALTER TABLE public.challenge_participants REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
