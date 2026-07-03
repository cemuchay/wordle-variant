-- 85_update_wordup_async_notifications.sql
-- Enhance WordUp async challenge notifications to include category, scores, and winner details.

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
        msg_str := creator_username || ' challenged you to an async WordUp match on "' || NEW.category || '"!';

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

            IF NEW.p2_answered = true THEN
                -- Both finished, determine winner
                IF NEW.p1_score > NEW.p2_score THEN
                    msg_str := opp_username || ' won the async match on "' || NEW.category || '" (' || NEW.p1_score || '-' || NEW.p2_score || ').';
                ELSIF NEW.p2_score > NEW.p1_score THEN
                    msg_str := 'You won the async match on "' || NEW.category || '" (' || NEW.p2_score || '-' || NEW.p1_score || ')!';
                ELSE
                    msg_str := 'The async match on "' || NEW.category || '" ended in a tie (' || NEW.p1_score || '-' || NEW.p2_score || ')!';
                END IF;
            ELSE
                -- P2 hasn't played yet
                msg_str := opp_username || ' finished their turn on "' || NEW.category || '" with a score of ' || NEW.p1_score || '! Your turn!';
            END IF;

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

            IF NEW.p1_answered = true THEN
                -- Both finished, determine winner
                IF NEW.p2_score > NEW.p1_score THEN
                    msg_str := opp_username || ' won the async match on "' || NEW.category || '" (' || NEW.p2_score || '-' || NEW.p1_score || ').';
                ELSIF NEW.p1_score > NEW.p2_score THEN
                    msg_str := 'You won the async match on "' || NEW.category || '" (' || NEW.p1_score || '-' || NEW.p2_score || ')!';
                ELSE
                    msg_str := 'The async match on "' || NEW.category || '" ended in a tie (' || NEW.p1_score || '-' || NEW.p2_score || ')!';
                END IF;
            ELSE
                -- P1 hasn't played yet
                msg_str := opp_username || ' finished their turn on "' || NEW.category || '" with a score of ' || NEW.p2_score || '! Your turn!';
            END IF;

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
