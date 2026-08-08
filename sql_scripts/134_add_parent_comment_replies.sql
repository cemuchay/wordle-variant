-- Add parent_id column to guess_comments to support reply threads
ALTER TABLE public.guess_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.guess_comments(id) ON DELETE CASCADE;

-- Update the handle_new_comment trigger function to send reply notifications
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    commenter_name VARCHAR;
    parent_comment_author_id UUID;
    guess_owner_name VARCHAR;
BEGIN
    SELECT username INTO commenter_name FROM public.profiles WHERE id = NEW.author_id;
    commenter_name := COALESCE(commenter_name, 'Someone');

    SELECT username INTO guess_owner_name FROM public.profiles WHERE id = NEW.target_user_id;
    guess_owner_name := COALESCE(guess_owner_name, 'Someone');

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
                'Comment Reply',
                '@' || commenter_name || ' replied to your comment on @' || guess_owner_name || '''s guesses',
                jsonb_build_object(
                    'commenter_id', NEW.author_id,
                    'game_date', NEW.game_date,
                    'guess_index', NEW.guess_index,
                    'parent_id', NEW.parent_id
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
            'New Comment',
            '@' || commenter_name || ' commented on your guess!',
            jsonb_build_object(
                'commenter_id', NEW.author_id,
                'game_date', NEW.game_date,
                'guess_index', NEW.guess_index
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
