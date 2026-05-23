-- 22_guest_profiles.sql
-- 1. Create Guest Profiles Table
CREATE TABLE IF NOT EXISTS public.guest_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;

-- Enable Realtime Replication for guest_profiles
ALTER TABLE public.guest_profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_profiles;

-- RLS Policies for guest_profiles
DROP POLICY IF EXISTS "Guest profiles are viewable by everyone" ON public.guest_profiles;
CREATE POLICY "Guest profiles are viewable by everyone" 
ON public.guest_profiles FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Anyone can insert guest profiles" ON public.guest_profiles;
CREATE POLICY "Anyone can insert guest profiles" 
ON public.guest_profiles FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update guest profiles" ON public.guest_profiles;
CREATE POLICY "Anyone can update guest profiles" 
ON public.guest_profiles FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

-- 2. Alter challenge_participants to Support Guests
-- Make user_id nullable
ALTER TABLE public.challenge_participants ALTER COLUMN user_id DROP NOT NULL;

-- Add guest_id column referencing guest_profiles
ALTER TABLE public.challenge_participants ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guest_profiles(id) ON DELETE CASCADE;

-- Add check constraint to enforce that EITHER user_id OR guest_id is set
ALTER TABLE public.challenge_participants DROP CONSTRAINT IF EXISTS challenge_participants_user_or_guest;
ALTER TABLE public.challenge_participants ADD CONSTRAINT challenge_participants_user_or_guest CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL AND guest_id IS NOT NULL)
);

-- Drop old UNIQUE constraint
ALTER TABLE public.challenge_participants DROP CONSTRAINT IF EXISTS challenge_participants_challenge_id_user_id_key;

-- Add separate unique indexes for users and guests
CREATE UNIQUE INDEX IF NOT EXISTS challenge_participants_challenge_user_idx 
ON public.challenge_participants (challenge_id, user_id) 
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS challenge_participants_challenge_guest_idx 
ON public.challenge_participants (challenge_id, guest_id) 
WHERE guest_id IS NOT NULL;

-- Update RLS Update Policy on challenge_participants
DROP POLICY IF EXISTS "Users can update own participation" ON public.challenge_participants;
CREATE POLICY "Users can update own participation" 
ON public.challenge_participants FOR UPDATE 
TO public
USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR 
    (guest_id IS NOT NULL AND auth.uid() IS NULL)
)
WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR 
    (guest_id IS NOT NULL AND auth.uid() IS NULL)
);

-- 3. Update Trigger Functions for Notification Events to handle null user_id (guests)
-- Trigger 1: challenge_participant_inserted
CREATE OR REPLACE FUNCTION public.handle_challenge_participant_inserted()
RETURNS TRIGGER AS $$
DECLARE
    ch_creator_id UUID;
    ch_word_length INTEGER;
    creator_username VARCHAR;
    msg_str TEXT;
BEGIN
    -- Return early if guest user (user_id is null)
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get challenge details
    SELECT creator_id, word_length INTO ch_creator_id, ch_word_length
    FROM public.challenges
    WHERE id = NEW.challenge_id;

    -- If this is an invited participant (not the creator), notify them
    IF NEW.user_id != ch_creator_id THEN
        SELECT username INTO creator_username 
        FROM public.profiles 
        WHERE id = ch_creator_id;

        creator_username := COALESCE(creator_username, 'Someone');

        IF ch_word_length = 1 THEN
            msg_str := creator_username || ' challenged you to a Marathon Wordle match!';
        ELSE
            msg_str := creator_username || ' challenged you to a ' || ch_word_length || '-letter Wordle match!';
        END IF;

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.user_id,
            'CHALLENGE_INVITE',
            'New Challenge!',
            msg_str,
            jsonb_build_object('challenge_id', NEW.challenge_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 2: challenge_participant_completed
CREATE OR REPLACE FUNCTION public.handle_challenge_participant_completed()
RETURNS TRIGGER AS $$
DECLARE
    ch_word_length INTEGER;
    player_username VARCHAR;
    msg_str TEXT;
    title_str TEXT;
    r RECORD;
BEGIN
    -- Only act if the status transitioned to completed or timed_out
    IF OLD.status = NEW.status OR NEW.status NOT IN ('completed', 'timed_out') THEN
        RETURN NEW;
    END IF;

    -- Get challenge info and player's username
    SELECT word_length INTO ch_word_length FROM public.challenges WHERE id = NEW.challenge_id;
    
    IF NEW.user_id IS NOT NULL THEN
        SELECT username INTO player_username FROM public.profiles WHERE id = NEW.user_id;
    ELSE
        SELECT username INTO player_username FROM public.guest_profiles WHERE id = NEW.guest_id;
    END IF;
    player_username := COALESCE(player_username, 'Someone');

    IF ch_word_length = 1 THEN
        title_str := 'Marathon Completed';
        msg_str := player_username || ' completed the Marathon challenge with ' || NEW.score || ' points!';
    ELSE
        title_str := 'Challenge Completed';
        IF NEW.status = 'timed_out' THEN
            msg_str := player_username || ' timed out in the challenge!';
        ELSE
            msg_str := player_username || ' completed the ' || ch_word_length || '-letter challenge in ' || NEW.attempts || ' attempts!';
        END IF;
    END IF;

    -- Notify all other participants in the challenge who are registered users
    FOR r IN (
        SELECT user_id FROM public.challenge_participants
        WHERE challenge_id = NEW.challenge_id 
          AND user_id IS NOT NULL 
          AND (NEW.user_id IS NULL OR user_id != NEW.user_id)
    ) LOOP
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            r.user_id,
            'CHALLENGE_COMPLETED',
            title_str,
            msg_str,
            jsonb_build_object('challenge_id', NEW.challenge_id, 'opponent_id', NEW.user_id)
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 3: marathon_game_completed
CREATE OR REPLACE FUNCTION public.handle_marathon_game_completed()
RETURNS TRIGGER AS $$
DECLARE
    ch_id UUID;
    player_id UUID;
    pl_guest_id UUID;
    player_username VARCHAR;
    msg_str TEXT;
    r RECORD;
BEGIN
    -- Only act if status is completed or timed_out
    IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) OR NEW.status NOT IN ('completed', 'timed_out') THEN
        RETURN NEW;
    END IF;

    -- Find challenge_id, user_id, and guest_id from parent participation
    SELECT challenge_id, user_id, guest_id INTO ch_id, player_id, pl_guest_id
    FROM public.challenge_participants
    WHERE id = NEW.participation_id;

    IF ch_id IS NULL OR (player_id IS NULL AND pl_guest_id IS NULL) THEN
        RETURN NEW;
    END IF;

    -- Get username of player
    IF player_id IS NOT NULL THEN
        SELECT username INTO player_username FROM public.profiles WHERE id = player_id;
    ELSE
        SELECT username INTO player_username FROM public.guest_profiles WHERE id = pl_guest_id;
    END IF;
    player_username := COALESCE(player_username, 'Someone');

    msg_str := player_username || ' completed the ' || NEW.word_length || '-letter game in the Marathon!';

    -- Notify all other participants in the challenge who are registered users
    FOR r IN (
        SELECT user_id FROM public.challenge_participants
        WHERE challenge_id = ch_id 
          AND user_id IS NOT NULL 
          AND (player_id IS NULL OR user_id != player_id)
    ) LOOP
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            r.user_id,
            'MARATHON_GAME_COMPLETED',
            'Marathon Progress',
            msg_str,
            jsonb_build_object('challenge_id', ch_id, 'opponent_id', player_id, 'word_length', NEW.word_length)
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
