-- 86_challenge_notifications_options.sql
-- 1. Alter challenges table to add notify_creator option
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS notify_creator BOOLEAN DEFAULT FALSE;

-- 2. Trigger: User Challenged & Creator Joined Notification Update
CREATE OR REPLACE FUNCTION public.handle_challenge_participant_inserted()
RETURNS TRIGGER AS $$
DECLARE
    ch_creator_id UUID;
    ch_word_length INTEGER;
    ch_notify_creator BOOLEAN;
    creator_username VARCHAR;
    participant_username VARCHAR;
    msg_str TEXT;
BEGIN
    -- Get challenge details
    SELECT creator_id, word_length, notify_creator INTO ch_creator_id, ch_word_length, ch_notify_creator
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

        -- Also notify the creator about the new participant if notify_creator option is enabled
        IF COALESCE(ch_notify_creator, FALSE) = TRUE THEN
            SELECT username INTO participant_username
            FROM public.profiles
            WHERE id = NEW.user_id;

            participant_username := COALESCE(participant_username, 'Someone');

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                ch_creator_id,
                'CHALLENGE_PARTICIPANT_JOINED',
                'New Participant Joined',
                participant_username || ' joined your challenge!',
                jsonb_build_object('challenge_id', NEW.challenge_id, 'participant_id', NEW.user_id)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Trigger: Challenge Completed (Opponent finished) Notification Update
CREATE OR REPLACE FUNCTION public.handle_challenge_participant_completed()
RETURNS TRIGGER AS $$
DECLARE
    ch_word_length INTEGER;
    ch_creator_id UUID;
    ch_notify_creator BOOLEAN;
    player_username VARCHAR;
    msg_str TEXT;
    creator_msg_str TEXT;
    title_str TEXT;
    r RECORD;
BEGIN
    -- Only act if the status transitioned to completed or timed_out
    IF OLD.status = NEW.status OR NEW.status NOT IN ('completed', 'timed_out') THEN
        RETURN NEW;
    END IF;

    -- Get challenge info and player's username
    SELECT word_length, creator_id, notify_creator INTO ch_word_length, ch_creator_id, ch_notify_creator
    FROM public.challenges
    WHERE id = NEW.challenge_id;

    SELECT username INTO player_username FROM public.profiles WHERE id = NEW.user_id;
    player_username := COALESCE(player_username, 'Someone');

    IF ch_word_length = 1 THEN
        title_str := 'Marathon Completed';
        msg_str := player_username || ' completed the Marathon challenge with ' || NEW.score || ' points!';
        creator_msg_str := player_username || ' completed your Marathon challenge with ' || NEW.score || ' points!';
    ELSE
        title_str := 'Challenge Completed';
        IF NEW.status = 'timed_out' THEN
            msg_str := player_username || ' timed out in the challenge!';
            creator_msg_str := player_username || ' timed out in your challenge!';
        ELSE
            msg_str := player_username || ' completed the ' || ch_word_length || '-letter challenge with a score of ' || NEW.score || ' (' || NEW.attempts || ' attempts)!';
            creator_msg_str := player_username || ' completed your ' || ch_word_length || '-letter challenge with a score of ' || NEW.score || ' (' || NEW.attempts || ' attempts)!';
        END IF;
    END IF;

    -- Notify all other participants in the challenge
    FOR r IN (
        SELECT user_id FROM public.challenge_participants
        WHERE challenge_id = NEW.challenge_id AND user_id != NEW.user_id
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

    -- Notify creator if they are not the player, and notify_creator is true
    IF COALESCE(ch_notify_creator, FALSE) = TRUE AND NEW.user_id != ch_creator_id THEN
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            ch_creator_id,
            'CHALLENGE_COMPLETED',
            title_str,
            creator_msg_str,
            jsonb_build_object('challenge_id', NEW.challenge_id, 'participant_id', NEW.user_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Trigger: Marathon Singular Game Completed Notification Update
CREATE OR REPLACE FUNCTION public.handle_marathon_game_completed()
RETURNS TRIGGER AS $$
DECLARE
    ch_id UUID;
    ch_creator_id UUID;
    ch_notify_creator BOOLEAN;
    ch_is_bot_marathon BOOLEAN;
    player_id UUID;
    player_username VARCHAR;
    msg_str TEXT;
    creator_msg_str TEXT;
    r RECORD;
BEGIN
    -- Only act if status is completed or timed_out
    IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) OR NEW.status NOT IN ('completed', 'timed_out') THEN
        RETURN NEW;
    END IF;

    -- Find challenge_id and user_id from parent participation
    SELECT challenge_id, user_id INTO ch_id, player_id
    FROM public.challenge_participants
    WHERE id = NEW.participation_id;

    IF ch_id IS NULL OR player_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if challenge is bot marathon or creator notifications enabled
    SELECT is_bot_marathon, creator_id, notify_creator INTO ch_is_bot_marathon, ch_creator_id, ch_notify_creator
    FROM public.challenges
    WHERE id = ch_id;

    -- Return early if this is a bot marathon challenge
    IF COALESCE(ch_is_bot_marathon, FALSE) THEN
        RETURN NEW;
    END IF;

    -- Get username of player
    SELECT username INTO player_username FROM public.profiles WHERE id = player_id;
    player_username := COALESCE(player_username, 'Someone');

    msg_str := player_username || ' completed the ' || NEW.word_length || '-letter game in the Marathon with a score of ' || NEW.score || ' (' || NEW.attempts || ' attempts)!';
    creator_msg_str := player_username || ' completed the ' || NEW.word_length || '-letter game in your Marathon challenge with a score of ' || NEW.score || ' (' || NEW.attempts || ' attempts)!';

    -- Notify all other participants in the challenge
    FOR r IN (
        SELECT user_id FROM public.challenge_participants
        WHERE challenge_id = ch_id AND user_id != player_id
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

    -- Notify creator if they are not the player, and notify_creator is true
    IF COALESCE(ch_notify_creator, FALSE) = TRUE AND player_id != ch_creator_id THEN
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            ch_creator_id,
            'MARATHON_GAME_COMPLETED',
            'Marathon Progress',
            creator_msg_str,
            jsonb_build_object('challenge_id', ch_id, 'participant_id', player_id, 'word_length', NEW.word_length)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Enable extension pg_cron if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 6. Cron schedule helper function for daily push reminders
CREATE OR REPLACE FUNCTION public.send_daily_reminders_morning()
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT DISTINCT sub.user_id, 'SYSTEM', 'Daily Variant Reminder', 'Good morning, Variant Word of the Day is ready, play now to get started!', jsonb_build_object('type', 'daily_reminder')
    FROM public.push_subscriptions sub
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.scores sc
        WHERE sc.user_id = sub.user_id 
          AND sc.game_date = to_char(timezone('Africa/Lagos', now()), 'YYYY-MM-DD')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.send_daily_reminders_afternoon()
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT DISTINCT sub.user_id, 'SYSTEM', 'Daily Variant Reminder', 'Don''t forget to finish your daily Variant game!', jsonb_build_object('type', 'daily_reminder')
    FROM public.push_subscriptions sub
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.scores sc
        WHERE sc.user_id = sub.user_id 
          AND sc.game_date = to_char(timezone('Africa/Lagos', now()), 'YYYY-MM-DD')
          AND sc.status IN ('won', 'lost')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Register/update schedules
-- Morning Job: 6:00 AM WAT -> 5:00 AM UTC
SELECT cron.schedule(
    'daily-morning-variant-reminder',
    '0 5 * * *',
    $$SELECT public.send_daily_reminders_morning()$$
);

-- Afternoon Job: 3:00 PM WAT -> 2:00 PM UTC
SELECT cron.schedule(
    'daily-afternoon-variant-reminder',
    '0 14 * * *',
    $$SELECT public.send_daily_reminders_afternoon()$$
);
