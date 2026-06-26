-- Notifications for async WordUp matches
-- Fires when:
--   1. A new async match is created (player2 is challenged)
--   2. An opponent finishes their turn

-- ══════════════════════════════════════════════════════════════════════
-- Function: handle_wordup_async_match_inserted
-- Fires on INSERT into wordup_async_matches
-- Notifies player2 about the new challenge
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_wordup_async_match_inserted()
RETURNS TRIGGER AS $$
DECLARE
    creator_username VARCHAR;
    msg_str TEXT;
BEGIN
    IF NEW.player2_id IS NOT NULL THEN
        SELECT username INTO creator_username
        FROM public.profiles
        WHERE id = NEW.player1_id;

        IF creator_username IS NULL THEN
            SELECT username INTO creator_username
            FROM public.guest_profiles
            WHERE id = NEW.player1_id;
        END IF;

        creator_username := COALESCE(creator_username, 'Someone');
        msg_str := creator_username || ' challenged you to an async WordUp match!';

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.player2_id,
            'CHALLENGE_INVITE',
            'New Async WordUp Challenge',
            msg_str,
            jsonb_build_object('mode', 'wordup_async', 'matchId', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════
-- Function: handle_wordup_async_match_updated
-- Fires on UPDATE of wordup_async_matches
-- Notifies the other player when someone finishes their turn
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_wordup_async_match_updated()
RETURNS TRIGGER AS $$
DECLARE
    opp_username VARCHAR;
    notify_user_id UUID;
    msg_str TEXT;
BEGIN
    -- Player 1 just submitted their turn → notify player 2
    IF NEW.p1_answered = true AND (OLD.p1_answered = false OR OLD.p1_answered IS NULL) THEN
        IF NEW.player2_id IS NOT NULL THEN
            notify_user_id := NEW.player2_id;

            SELECT username INTO opp_username
            FROM public.profiles
            WHERE id = NEW.player1_id;

            IF opp_username IS NULL THEN
                SELECT username INTO opp_username
                FROM public.guest_profiles
                WHERE id = NEW.player1_id;
            END IF;

            opp_username := COALESCE(opp_username, 'Your opponent');
            msg_str := opp_username || ' has finished their turn in your async match!';

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                notify_user_id,
                'CHALLENGE_COMPLETED',
                'Opponent Finished Their Turn',
                msg_str,
                jsonb_build_object('mode', 'wordup_async', 'matchId', NEW.id)
            );
        END IF;
    END IF;

    -- Player 2 just submitted their turn → notify player 1
    IF NEW.p2_answered = true AND (OLD.p2_answered = false OR OLD.p2_answered IS NULL) THEN
        IF NEW.player1_id IS NOT NULL THEN
            notify_user_id := NEW.player1_id;

            SELECT username INTO opp_username
            FROM public.profiles
            WHERE id = NEW.player2_id;

            IF opp_username IS NULL THEN
                SELECT username INTO opp_username
                FROM public.guest_profiles
                WHERE id = NEW.player2_id;
            END IF;

            opp_username := COALESCE(opp_username, 'Your opponent');
            msg_str := opp_username || ' has finished their turn in your async match!';

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                notify_user_id,
                'CHALLENGE_COMPLETED',
                'Opponent Finished Their Turn',
                msg_str,
                jsonb_build_object('mode', 'wordup_async', 'matchId', NEW.id)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════
-- Triggers
-- ══════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_wordup_async_match_inserted ON public.wordup_async_matches;
CREATE TRIGGER trigger_wordup_async_match_inserted
AFTER INSERT ON public.wordup_async_matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_wordup_async_match_inserted();

DROP TRIGGER IF EXISTS trigger_wordup_async_match_updated ON public.wordup_async_matches;
CREATE TRIGGER trigger_wordup_async_match_updated
AFTER UPDATE ON public.wordup_async_matches
FOR EACH ROW
WHEN (OLD.p1_answered IS DISTINCT FROM NEW.p1_answered OR OLD.p2_answered IS DISTINCT FROM NEW.p2_answered)
EXECUTE FUNCTION public.handle_wordup_async_match_updated();
