-- 1. Alter the public.challenges CHECK constraint to support word lengths up to 10.
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_word_length_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_word_length_check
CHECK (word_length >= 1 AND word_length <= 10);

-- 2. Alter the public.challenge_participants_marathon CHECK constraint to support word lengths up to 10.
ALTER TABLE public.challenge_participants_marathon
DROP CONSTRAINT IF EXISTS challenge_participants_marathon_word_length_check;

ALTER TABLE public.challenge_participants_marathon
ADD CONSTRAINT challenge_participants_marathon_word_length_check
CHECK (word_length >= 3 AND word_length <= 10);
