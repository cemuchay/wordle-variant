-- Restores CHALLENGE_INVITE notifications after beta
-- Re-applies: sql_scripts/61_wordup_notifications.sql

CREATE OR REPLACE FUNCTION public.handle_wordup_match_inserted()
RETURNS TRIGGER AS $$
DECLARE
    creator_username VARCHAR;
    msg_str TEXT;
BEGIN
    -- Only notify player 2 if it's not a bot match
    IF NEW.is_bot_match = FALSE AND NEW.player2_id IS NOT NULL THEN
        SELECT username INTO creator_username
        FROM public.profiles
        WHERE id = NEW.player1_id;

        creator_username := COALESCE(creator_username, 'Someone');
        msg_str := creator_username || ' challenged you to a WordUp Battle!';

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.player2_id,
            'CHALLENGE_INVITE',
            'New WordUp Challenge',
            msg_str,
            jsonb_build_object('mode', 'wordup', 'matchId', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_wordup_match_inserted ON public.wordup_matches;
CREATE TRIGGER trigger_wordup_match_inserted
AFTER INSERT ON public.wordup_matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_wordup_match_inserted();
