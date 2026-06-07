-- Index the participation mapping
CREATE INDEX IF NOT EXISTS idx_challenge_participants_lookup 
ON public.challenge_participants (user_id, guest_id, challenge_id);

-- Index the progress table mapping
CREATE INDEX IF NOT EXISTS idx_marathon_progress_participation 
ON public.challenge_participants_marathon (participation_id);