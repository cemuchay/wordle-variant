-- Create indices to optimize chat queries
CREATE INDEX IF NOT EXISTS idx_challenge_messages_challenge_id ON public.challenge_messages(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_messages_created_at ON public.challenge_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_challenge_messages_challenge_created ON public.challenge_messages(challenge_id, created_at ASC);
