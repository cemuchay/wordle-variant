CREATE OR REPLACE FUNCTION public.handle_new_dm_message()
RETURNS TRIGGER AS $$
DECLARE
    group_type TEXT;
    recipient_id UUID;
    sender_username VARCHAR;
BEGIN
    -- Get the group type
    SELECT type INTO group_type FROM public.chat_groups WHERE id = NEW.group_id;

    -- Only generate notifications for Direct Messages (DMs)
    IF group_type = 'dm' THEN
        -- Find the other member of the DM group
        SELECT user_id INTO recipient_id
        FROM public.chat_group_members
        WHERE group_id = NEW.group_id AND user_id != NEW.user_id
        LIMIT 1;

        IF recipient_id IS NOT NULL THEN
            -- Get sender username for the message body
            SELECT username INTO sender_username FROM public.profiles WHERE id = NEW.user_id;
            sender_username := COALESCE(sender_username, 'Someone');

            -- Insert the private notification with a generic message for privacy
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                recipient_id,
                'DM_MESSAGE',
                'New Message',
                'You have a new message from ' || sender_username || ', open to see.',
                jsonb_build_object(
                    'group_id', NEW.group_id,
                    'message_id', NEW.id,
                    'sender_id', NEW.user_id
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;