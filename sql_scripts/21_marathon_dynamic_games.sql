-- Add game_index column to marathon progress table
ALTER TABLE public.challenge_participants_marathon ADD COLUMN IF NOT EXISTS game_index INTEGER;

-- Backfill legacy records: map word_length (3-7) to game_index (0-4)
UPDATE public.challenge_participants_marathon 
SET game_index = word_length - 3 
WHERE game_index IS NULL;

-- Make game_index NOT NULL and set a default
ALTER TABLE public.challenge_participants_marathon ALTER COLUMN game_index SET NOT NULL;
ALTER TABLE public.challenge_participants_marathon ALTER COLUMN game_index SET DEFAULT 0;

-- Drop legacy unique constraint on (participation_id, word_length)
ALTER TABLE public.challenge_participants_marathon 
DROP CONSTRAINT IF EXISTS challenge_participants_marathon_participation_id_word_length_key;
ALTER TABLE public.challenge_participants_marathon 
DROP CONSTRAINT IF EXISTS challenge_participants_maratho_participation_id_word_length_key;

-- Add new unique constraint on (participation_id, game_index)
ALTER TABLE public.challenge_participants_marathon 
DROP CONSTRAINT IF EXISTS challenge_participants_marathon_participation_id_game_index_key;

ALTER TABLE public.challenge_participants_marathon 
ADD CONSTRAINT challenge_participants_marathon_participation_id_game_index_key 
UNIQUE (participation_id, game_index);
