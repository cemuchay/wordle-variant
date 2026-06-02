-- 40_fix_database_security_rls.sql
-- Enable Row-Level Security on tables that are currently publicly accessible.

-- 1. Secure public.cache_settings
-- This table contains the internal API secrets. It should NOT be readable by any public/authenticated role.
-- PostgreSQL Security Definer functions (e.g. request_cache_invalidation) run as the owner and bypass RLS,
-- which allows the database triggers to read settings while blocking client queries.
ALTER TABLE public.cache_settings ENABLE ROW LEVEL SECURITY;
-- By enabling RLS and not defining any policies, all select/insert/update/delete operations from anonymous
-- and authenticated public keys are blocked by default.

-- 2. Secure public.messages
-- Enable Row-Level Security to activate the existing policies ("Select messages if member of group", etc.).
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Secure public.scores
-- Enable RLS and define standard policies allowing public read (for leaderboards), but restricting
-- insert and update operations to the owner user only.
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone can see scores for leaderboard calculations
DROP POLICY IF EXISTS "Allow public read access to scores" ON public.scores;
CREATE POLICY "Allow public read access to scores"
ON public.scores FOR SELECT
TO public
USING (true);

-- Insert policy: Authenticated users can only record their own scores
DROP POLICY IF EXISTS "Allow authenticated users to insert their own scores" ON public.scores;
CREATE POLICY "Allow authenticated users to insert their own scores"
ON public.scores FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update policy: Authenticated users can only edit their own scores
DROP POLICY IF EXISTS "Allow authenticated users to update their own scores" ON public.scores;
CREATE POLICY "Allow authenticated users to update their own scores"
ON public.scores FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
