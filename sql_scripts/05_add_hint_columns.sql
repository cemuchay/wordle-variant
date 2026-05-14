-- Add hint-related columns to challenge_participants
ALTER TABLE public.challenge_participants 
ADD COLUMN IF NOT EXISTS hints_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hint_record JSONB DEFAULT NULL;

-- Add hint-related columns to scores
ALTER TABLE public.scores
ADD COLUMN IF NOT EXISTS hints_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hint_record JSONB DEFAULT NULL;
