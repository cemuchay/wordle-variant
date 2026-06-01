-- Alter the public.challenges CHECK constraint to support word lengths up to 10.
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_word_length_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_word_length_check
CHECK (word_length >= 1 AND word_length <= 10);
