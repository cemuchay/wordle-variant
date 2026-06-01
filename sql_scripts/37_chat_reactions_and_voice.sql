-- 37_chat_reactions_and_voice.sql
-- Migration to support message reactions, voice notes, mention notifications, and 24-hour cleanup cron jobs.

-- 1. Add reactions and voice_url columns to messages and challenge_messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS voice_url TEXT;

ALTER TABLE public.challenge_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.challenge_messages ADD COLUMN IF NOT EXISTS voice_url TEXT;

-- 2. Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for voice-notes bucket (allow uploads and public reads)
DROP POLICY IF EXISTS "Allow authenticated and anonymous upload of voice notes" ON storage.objects;
CREATE POLICY "Allow authenticated and anonymous upload of voice notes"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'voice-notes');

DROP POLICY IF EXISTS "Allow public read of voice notes" ON storage.objects;
CREATE POLICY "Allow public read of voice notes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'voice-notes');

-- 4. Enable pg_cron if it is available and not enabled yet
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Schedule an hourly cron job to purge voice note messages and storage objects older than 24 hours
SELECT cron.schedule(
    'purge-expired-voice-notes',
    '0 * * * *', -- Every hour on the hour
    $$
    BEGIN
        -- Purge expired audio objects from storage.objects
        -- We extract the filename or match based on path in bucket
        DELETE FROM storage.objects WHERE bucket_id = 'voice-notes' AND created_at < now() - INTERVAL '24 hours';
        
        -- Purge voice messages from public.messages
        DELETE FROM public.messages WHERE voice_url IS NOT NULL AND created_at < now() - INTERVAL '24 hours';
    END;
    $$
);

-- 6. Trigger to automate sending notifications for chat mentions
CREATE OR REPLACE FUNCTION public.handle_chat_mention()
RETURNS TRIGGER AS $$
DECLARE
    sender_username VARCHAR;
    mentioned_id UUID;
    msg_content TEXT;
BEGIN
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
                    jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.user_id)
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_chat_mention ON public.messages;
CREATE TRIGGER trigger_chat_mention
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_chat_mention();
