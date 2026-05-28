-- 32_add_challenge_id_to_marathon.sql
-- Add challenge_id to challenge_participants_marathon to allow direct subscription filtering

-- 1. Add challenge_id column (initially nullable to allow backfilling)
ALTER TABLE public.challenge_participants_marathon 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE;

-- 2. Backfill challenge_id from parent challenge_participants
UPDATE public.challenge_participants_marathon m
SET challenge_id = p.challenge_id
FROM public.challenge_participants p
WHERE m.participation_id = p.id AND m.challenge_id IS NULL;

-- 3. Make it NOT NULL
ALTER TABLE public.challenge_participants_marathon 
ALTER COLUMN challenge_id SET NOT NULL;

-- 4. Create index for fast filtering on realtime channels and queries
CREATE INDEX IF NOT EXISTS idx_marathon_challenge_id 
ON public.challenge_participants_marathon(challenge_id);

-- 5. Add database cache invalidation trigger for marathon updates
CREATE OR REPLACE FUNCTION public.handle_marathon_cache_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  -- Invalidate the challenge lobby cache for the challenge ID
  PERFORM public.request_cache_invalidation('challenge:lobby:' || NEW.challenge_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invalidate_marathon_cache ON public.challenge_participants_marathon;
CREATE TRIGGER trigger_invalidate_marathon_cache
AFTER INSERT OR UPDATE OR DELETE ON public.challenge_participants_marathon
FOR EACH ROW
EXECUTE FUNCTION public.handle_marathon_cache_invalidation();
