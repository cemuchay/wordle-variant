-- 46_marathon_user_uniqueness.sql

-- Add user_id and guest_id columns
ALTER TABLE public.challenge_participants_marathon
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guest_profiles(id) ON DELETE CASCADE;


-- Populate user_id/guest_id automatically
CREATE OR REPLACE FUNCTION public.set_marathon_user_ids()
RETURNS TRIGGER AS $$
BEGIN
    SELECT p.user_id, p.guest_id
    INTO NEW.user_id, NEW.guest_id
    FROM public.challenge_participants p
    WHERE p.id = NEW.participation_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS trigger_set_marathon_user_ids
ON public.challenge_participants_marathon;

CREATE TRIGGER trigger_set_marathon_user_ids
BEFORE INSERT OR UPDATE OF participation_id
ON public.challenge_participants_marathon
FOR EACH ROW
EXECUTE FUNCTION public.set_marathon_user_ids();


-- Backfill existing rows
UPDATE public.challenge_participants_marathon m
SET
    user_id = p.user_id,
    guest_id = p.guest_id
FROM public.challenge_participants p
WHERE
    m.participation_id = p.id
    AND (m.user_id IS NULL OR m.guest_id IS NULL);


-- Remove old uniqueness constraint
ALTER TABLE public.challenge_participants_marathon
DROP CONSTRAINT IF EXISTS challenge_participants_marathon_participation_id_game_index_pla;


---------------------------------------------------------
-- DAILY GAMES
--
-- Only one marathon record per user/game_index/day across
-- the entire system.
---------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_marathon_user_daily_game
ON public.challenge_participants_marathon
(user_id, game_index, play_date)
WHERE
    user_id IS NOT NULL
    AND play_date <> DATE '1970-01-01';


CREATE UNIQUE INDEX IF NOT EXISTS uq_marathon_guest_daily_game
ON public.challenge_participants_marathon
(guest_id, game_index, play_date)
WHERE
    guest_id IS NOT NULL
    AND play_date <> DATE '1970-01-01';


---------------------------------------------------------
-- REGULAR GAMES
--
-- Allow the same user to play multiple different
-- marathon challenges, but only once per participation.
---------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_marathon_participation_regular_game
ON public.challenge_participants_marathon
(participation_id, game_index)
WHERE play_date = DATE '1970-01-01';