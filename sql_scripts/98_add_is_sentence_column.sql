-- Add is_sentence column to challenges table
-- Sentence games are regular marathon games (word_length = 1)
-- that form a coherent sentence when all words are completed.

ALTER TABLE public.challenges 
ADD COLUMN is_sentence boolean NOT NULL DEFAULT false;

-- Backfill existing sentence challenges (detected by '_sentence' suffix in salt)
UPDATE public.challenges 
SET is_sentence = true 
WHERE salt LIKE '%_sentence';
