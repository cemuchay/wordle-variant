-- 1. Ensure word_length can be 1 (Signifies Marathon Mode)
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_word_length_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_word_length_check
CHECK (word_length >= 1 AND word_length <= 7);

-- 2. Ensure mode check allows LIVE and ANYTIME 
-- (If you previously added 'MARATHON' to mode, this reverts it to standard)
ALTER TABLE public.challenges 
DROP CONSTRAINT IF EXISTS challenges_mode_check;

ALTER TABLE public.challenges 
ADD CONSTRAINT challenges_mode_check 
CHECK (mode IN ('LIVE', 'ANYTIME'));

-- 3. Update target_word column length if not already done
-- Marathon mode stores multiple words as a JSON string
ALTER TABLE public.challenges 
ALTER COLUMN target_word TYPE TEXT;
