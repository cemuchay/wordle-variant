-- 145_comment_push_notification_preview.sql
-- Include comment preview in notification message and payload for comments and replies

CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    commenter_name VARCHAR;
    parent_comment_author_id UUID;
    guess_owner_name VARCHAR;
    comment_snippet TEXT;
BEGIN
    SELECT username INTO commenter_name FROM public.profiles WHERE id = NEW.author_id;
    commenter_name := COALESCE(commenter_name, 'Someone');

    SELECT username INTO guess_owner_name FROM public.profiles WHERE id = NEW.target_user_id;
    guess_owner_name := COALESCE(guess_owner_name, 'Someone');

    -- Truncate comment text to first 70 chars if long
    IF length(NEW.content) > 70 THEN
        comment_snippet := substring(NEW.content from 1 for 67) || '...';
    ELSE
        comment_snippet := NEW.content;
    END IF;

    -- If it's a reply to another comment
    IF NEW.parent_id IS NOT NULL THEN
        -- Find the author of the parent comment
        SELECT author_id INTO parent_comment_author_id FROM public.guess_comments WHERE id = NEW.parent_id;
        
        -- Notify the parent comment's author if it's not themselves
        IF parent_comment_author_id IS NOT NULL AND parent_comment_author_id != NEW.author_id THEN
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                parent_comment_author_id,
                'NEW_COMMENT',
                '@' || commenter_name || ' replied to your comment',
                '"' || comment_snippet || '"',
                jsonb_build_object(
                    'commenter_id', NEW.author_id,
                    'target_user_id', NEW.target_user_id,
                    'game_date', NEW.game_date,
                    'guess_index', NEW.guess_index,
                    'parent_id', NEW.parent_id,
                    'comment_preview', comment_snippet
                )
            );
        END IF;
    END IF;

    -- Also notify the owner of the guess, unless the commenter is the guess owner
    -- Or if the guess owner already got notified as the parent author (to avoid double notification)
    IF NEW.author_id != NEW.target_user_id AND (NEW.parent_id IS NULL OR parent_comment_author_id IS NULL OR parent_comment_author_id != NEW.target_user_id) THEN
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.target_user_id,
            'NEW_COMMENT',
            '@' || commenter_name || ' commented on your guess',
            '"' || comment_snippet || '"',
            jsonb_build_object(
                'commenter_id', NEW.author_id,
                'target_user_id', NEW.target_user_id,
                'game_date', NEW.game_date,
                'guess_index', NEW.guess_index,
                'comment_preview', comment_snippet
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
