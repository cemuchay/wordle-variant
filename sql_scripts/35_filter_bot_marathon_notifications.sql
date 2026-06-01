-- 35_filter_bot_marathon_notifications.sql
-- Update database trigger to filter out bot marathon single game progress notifications.

CREATE OR REPLACE FUNCTION public.handle_marathon_game_completed()
RETURNS TRIGGER AS $$
DECLARE
    ch_id UUID;
    ch_is_bot_marathon BOOLEAN;
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

    -- Check if challenge is bot marathon
    SELECT is_bot_marathon INTO ch_is_bot_marathon
    FROM public.challenges
    WHERE id = ch_id;

    -- Return early if this is a bot marathon challenge
    IF COALESCE(ch_is_bot_marathon, FALSE) THEN
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
