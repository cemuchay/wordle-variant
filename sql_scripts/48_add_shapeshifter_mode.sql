-- Add Shape Shifter mode fields
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS is_shapeshifter BOOLEAN DEFAULT FALSE;

ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS target_words JSONB DEFAULT NULL;

ALTER TABLE public.challenge_participants_marathon
ADD COLUMN IF NOT EXISTS target_words JSONB DEFAULT NULL;
