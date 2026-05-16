-- Add MARATHON to the allowed modes for challenges
ALTER TABLE public.challenges 
DROP CONSTRAINT IF EXISTS challenges_mode_check;

ALTER TABLE public.challenges 
ADD CONSTRAINT challenges_mode_check 
CHECK (mode IN ('LIVE', 'ANYTIME', 'MARATHON'));

-- Allow word_length 0 for Marathon mode
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_word_length_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_word_length_check
CHECK (word_length >= 0 AND word_length <= 7);
