-- 13_notification_events.sql
-- Database triggers to automate sending notifications for various social game states:
-- 1. When a user is challenged (invited to a match).
-- 2. When an opponent completes their challenge.
-- 3. When an opponent completes a single word in Marathon mode.
-- 4. When a user is overtaken on the weekly leaderboard.

-- ==========================================
-- 1. TRIGGER: User Challenged (Invitation)
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_challenge_participant_inserted()
RETURNS TRIGGER AS $$
DECLARE
    ch_creator_id UUID;
    ch_word_length INTEGER;
    creator_username VARCHAR;
    msg_str TEXT;
BEGIN
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

DROP TRIGGER IF EXISTS trigger_challenge_participant_inserted ON public.challenge_participants;
CREATE TRIGGER trigger_challenge_participant_inserted
AFTER INSERT ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_challenge_participant_inserted();


-- ==========================================
-- 2. TRIGGER: Challenge Completed (Opponent finished)
-- ==========================================
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
    SELECT username INTO player_username FROM public.profiles WHERE id = NEW.user_id;
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_challenge_participant_completed ON public.challenge_participants;
CREATE TRIGGER trigger_challenge_participant_completed
AFTER UPDATE ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_challenge_participant_completed();


-- ==========================================
-- 3. TRIGGER: Marathon Singular Game Completed
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_marathon_game_completed()
RETURNS TRIGGER AS $$
DECLARE
    ch_id UUID;
    ch_is_bot_marathon BOOLEAN;
    player_id UUID;
    player_username VARCHAR;
    msg_str TEXT;
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

    -- Check if challenge is bot marathon
    SELECT is_bot_marathon INTO ch_is_bot_marathon
    FROM public.challenges
    WHERE id = ch_id;

    -- Return early if this is a bot marathon challenge
    IF COALESCE(ch_is_bot_marathon, FALSE) THEN
        RETURN NEW;
    END IF;

    -- Get username of player
    SELECT username INTO player_username FROM public.profiles WHERE id = player_id;
    player_username := COALESCE(player_username, 'Someone');

    msg_str := player_username || ' completed the ' || NEW.word_length || '-letter game in the Marathon!';

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_marathon_game_completed ON public.challenge_participants_marathon;
CREATE TRIGGER trigger_marathon_game_completed
AFTER INSERT OR UPDATE ON public.challenge_participants_marathon
FOR EACH ROW
EXECUTE FUNCTION public.handle_marathon_game_completed();


-- ==========================================
-- 4. TRIGGER: Leaderboard Overtaken
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_score_overtaken()
RETURNS TRIGGER AS $$
DECLARE
    new_weekly_score INTEGER;
    old_weekly_score INTEGER;
    overtaker_username VARCHAR;
    week_start DATE;
    week_end DATE;
    r RECORD;
BEGIN
    -- Only proceed if score > 0
    IF NEW.skill_score = 0 OR (TG_OP = 'UPDATE' AND OLD.skill_score = NEW.skill_score) THEN
        RETURN NEW;
    END IF;

    -- Get week bounds (Monday to Sunday) based on the game date
    week_start := date_trunc('week', (NEW.game_date::text)::date)::date;
    week_end := (week_start + interval '7 days')::date;

    -- Calculate user's new weekly total score (already includes NEW row)
    SELECT COALESCE(SUM(skill_score), 0) INTO new_weekly_score
    FROM public.scores
    WHERE user_id = NEW.user_id
      AND (game_date::text)::date >= week_start
      AND (game_date::text)::date < week_end;

    -- Calculate user's old weekly total score
    IF TG_OP = 'UPDATE' THEN
        old_weekly_score := new_weekly_score - NEW.skill_score + OLD.skill_score;
    ELSE
        old_weekly_score := new_weekly_score - NEW.skill_score;
    END IF;

    -- If no change in total score, skip
    IF new_weekly_score = old_weekly_score THEN
        RETURN NEW;
    END IF;

    -- Get overtaker's username
    SELECT username INTO overtaker_username FROM public.profiles WHERE id = NEW.user_id;
    overtaker_username := COALESCE(overtaker_username, 'Someone');

    -- Find users in the same week who were overtaken
    -- Overtaken users are those whose total score was previously >= player's old score,
    -- but is now < player's new score.
    FOR r IN (
        SELECT user_id, COALESCE(SUM(skill_score), 0) as total_score
        FROM public.scores
        WHERE (game_date::text)::date >= week_start
          AND (game_date::text)::date < week_end
          AND user_id != NEW.user_id
        GROUP BY user_id
    ) LOOP
        IF r.total_score >= old_weekly_score AND r.total_score < new_weekly_score THEN
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                r.user_id,
                'LEADERBOARD_OVERTAKEN',
                'Overtaken!',
                overtaker_username || ' overtook you on the weekly leaderboard with ' || new_weekly_score || ' points!',
                jsonb_build_object(
                    'overtaker_id', NEW.user_id,
                    'new_score', new_weekly_score,
                    'timeframe', 'weekly'
                )
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_score_overtaken ON public.scores;
CREATE TRIGGER trigger_score_overtaken
AFTER INSERT OR UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.handle_score_overtaken();
