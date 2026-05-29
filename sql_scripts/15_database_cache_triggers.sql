-- 15_database_cache_triggers.sql
-- Postgres triggers to automate cache invalidation via Edge Function calls

-- Create a settings table to store configurations safely
CREATE TABLE IF NOT EXISTS public.cache_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Pre-populate defaults (WARNING: For production, you must update these values in your Supabase SQL editor to match your production URL and secret)
INSERT INTO public.cache_settings (key, value) VALUES
('edge_function_url', 'http://kong:8000/functions/v1/redis-cache'), -- default internal local kong url (update to 'https://<project-ref>.supabase.co/functions/v1/redis-cache' in production)
('internal_secret', 'my-shared-secret-token') -- default local internal secret (update to match the INTERNAL_SECRET env var in production)
ON CONFLICT (key) DO NOTHING;

-- Enable pg_net extension for network calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to perform async invalidation call via pg_net
CREATE OR REPLACE FUNCTION public.request_cache_invalidation(key_to_invalidate TEXT)
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
    RAISE WARNING 'Cache Settings not configured. Skipping cache invalidation.';
    RETURN;
  END IF;

  headers_json := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', ef_secret
  );

  body_json := jsonb_build_object(
    'action', 'invalidate',
    'key', key_to_invalidate
  );

  PERFORM net.http_post(
    url := ef_url,
    headers := headers_json,
    body := body_json
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 1. TRIGGERS: public.scores table
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_score_cache_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only invalidate weekly and monthly leaderboards on game completion (won/lost status)
  IF NEW.status IN ('won', 'lost') THEN
    PERFORM public.request_cache_invalidation('leaderboard:weekly');
    PERFORM public.request_cache_invalidation('leaderboard:monthly');
  END IF;
  
  -- Also invalidate the specific user's cached score for that day
  PERFORM public.request_cache_invalidation('score:' || NEW.user_id || ':' || NEW.game_date);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invalidate_score_cache ON public.scores;
CREATE TRIGGER trigger_invalidate_score_cache
AFTER INSERT OR UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.handle_score_cache_invalidation();


-- ==========================================
-- 2. TRIGGERS: public.profiles table
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_profile_cache_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only invalidate cache if username or avatar_url changed (bypass last_seen_at spam)
  IF (OLD.username IS DISTINCT FROM NEW.username) OR (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    PERFORM public.request_cache_invalidation('profile:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invalidate_profile_cache ON public.profiles;
CREATE TRIGGER trigger_invalidate_profile_cache
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_cache_invalidation();


-- ==========================================
-- 3. TRIGGERS: public.challenges table
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_challenge_cache_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.request_cache_invalidation('challenge:lobby:' || NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invalidate_challenge_cache ON public.challenges;
CREATE TRIGGER trigger_invalidate_challenge_cache
AFTER UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.handle_challenge_cache_invalidation();


-- ==========================================
-- 4. TRIGGERS: public.challenge_participants table
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_challenge_participant_cache_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  -- Invalidate the challenge lobby cache for the challenge ID
  IF TG_OP = 'DELETE' THEN
    PERFORM public.request_cache_invalidation('challenge:lobby:' || OLD.challenge_id);
    RETURN OLD;
  ELSE
    PERFORM public.request_cache_invalidation('challenge:lobby:' || NEW.challenge_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invalidate_challenge_participant_cache ON public.challenge_participants;
CREATE TRIGGER trigger_invalidate_challenge_participant_cache
AFTER INSERT OR UPDATE OR DELETE ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_challenge_participant_cache_invalidation();
