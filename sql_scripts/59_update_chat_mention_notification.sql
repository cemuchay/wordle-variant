-- 59_update_chat_mention_notification.sql
-- Update handle_chat_mention to include group_id and group_type in notification data.

CREATE OR REPLACE FUNCTION public.handle_chat_mention()
RETURNS TRIGGER AS $$
DECLARE
    sender_username VARCHAR;
    mentioned_id UUID;
    msg_content TEXT;
    v_group_type TEXT;
BEGIN
    -- Get the group type
    SELECT type INTO v_group_type FROM public.chat_groups WHERE id = NEW.group_id;

    -- Check if mentions exists and has items
    IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions, 1) > 0 THEN
        -- Get sender username
        SELECT username INTO sender_username FROM public.profiles WHERE id = NEW.user_id;
        sender_username := COALESCE(sender_username, 'Someone');
        
        -- Trim content for display in message
        msg_content := substring(NEW.content from 1 for 60);
        IF char_length(NEW.content) > 60 THEN
            msg_content := msg_content || '...';
        END IF;

        -- Loop through each user ID in mentions
        FOREACH mentioned_id IN ARRAY NEW.mentions LOOP
            -- Don't notify self
            IF mentioned_id != NEW.user_id THEN
                INSERT INTO public.notifications (user_id, type, title, message, data)
                VALUES (
                    mentioned_id,
                    'CHAT_MENTION',
                    'Chat Mention',
                    sender_username || ' mentioned you in chat: ' || msg_content,
                    jsonb_build_object(
                        'group_id', NEW.group_id,
                        'group_type', v_group_type,
                        'message_id', NEW.id, 
                        'sender_id', NEW.user_id
                    )
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
