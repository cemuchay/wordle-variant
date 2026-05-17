-- Add time_taken column to challenge_participants
ALTER TABLE public.challenge_participants 
ADD COLUMN IF NOT EXISTS time_taken INTEGER DEFAULT NULL;

-- Add time_taken column to challenge_participants_marathon
ALTER TABLE public.challenge_participants_marathon 
ADD COLUMN IF NOT EXISTS time_taken INTEGER DEFAULT NULL;

-- Description: time_taken stores the duration in seconds.
