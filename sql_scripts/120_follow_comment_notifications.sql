-- Trigger to automatically create notifications for new follows
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER AS $$
DECLARE
    follower_name VARCHAR;
BEGIN
    SELECT username INTO follower_name FROM public.profiles WHERE id = NEW.follower_id;
    follower_name := COALESCE(follower_name, 'Someone');

    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        NEW.following_id,
        'NEW_FOLLOWER',
        'New Follower',
        '@' || follower_name || ' is now following you!',
        jsonb_build_object('follower_id', NEW.follower_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_new_follow ON public.follows;
CREATE TRIGGER trigger_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_follow();

-- Trigger to automatically create notifications for new guess comments
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    commenter_name VARCHAR;
BEGIN
    -- Don't notify if commenting on own guess
    IF NEW.author_id = NEW.target_user_id THEN
        RETURN NEW;
    END IF;

    SELECT username INTO commenter_name FROM public.profiles WHERE id = NEW.author_id;
    commenter_name := COALESCE(commenter_name, 'Someone');

    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        NEW.target_user_id,
        'NEW_COMMENT',
        'New Comment',
        '@' || commenter_name || ' commented on your guess!',
        jsonb_build_object(
            'commenter_id', NEW.author_id,
            'game_date', NEW.game_date,
            'guess_index', NEW.guess_index
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_new_comment ON public.guess_comments;
CREATE TRIGGER trigger_new_comment
AFTER INSERT ON public.guess_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_comment();
