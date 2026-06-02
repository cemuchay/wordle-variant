-- 39_chat_groups_schema.sql
-- Overhaul chat schema to support chat groups, DMs, invites, image sharing, and automated 24h purging.

-- 1. Create chat_groups table
CREATE TABLE IF NOT EXISTS public.chat_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('general', 'game_analysis', 'bugs_features', 'dm', 'custom')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_core BOOLEAN DEFAULT false
);

-- 2. Create chat_group_members table
CREATE TABLE IF NOT EXISTS public.chat_group_members (
    group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'joined' CHECK (status IN ('invited', 'joined', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- 3. Alter public.messages to include group_id and image_url
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 4. Alter public.challenge_messages to include image_url
ALTER TABLE public.challenge_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 5. Insert core groups with static UUIDs
INSERT INTO public.chat_groups (id, name, type, is_core)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'General', 'general', true),
    ('00000000-0000-0000-0000-000000000002', 'Game Analysis', 'game_analysis', true),
    ('00000000-0000-0000-0000-000000000003', 'Bugs & Features', 'bugs_features', true)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    is_core = EXCLUDED.is_core;

-- 6. Backfill existing messages to General group
UPDATE public.messages 
SET group_id = '00000000-0000-0000-0000-000000000001' 
WHERE group_id IS NULL;

-- 7. Enforce NOT NULL on group_id in public.messages
ALTER TABLE public.messages ALTER COLUMN group_id SET NOT NULL;

-- 8. Group Creation Constraint Trigger (Creator max 2 custom groups)
CREATE OR REPLACE FUNCTION public.check_user_custom_group_limit()
RETURNS TRIGGER AS $$
DECLARE
    group_count INTEGER;
BEGIN
    IF NEW.type = 'custom' THEN
        SELECT count(*) INTO group_count 
        FROM public.chat_groups 
        WHERE created_by = NEW.created_by AND type = 'custom';
        
        IF group_count >= 2 THEN
            RAISE EXCEPTION 'You cannot create more than 2 custom groups.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_group_limit ON public.chat_groups;
CREATE TRIGGER trigger_check_group_limit
BEFORE INSERT ON public.chat_groups
FOR EACH ROW
EXECUTE FUNCTION public.check_user_custom_group_limit();

-- 9. Enable RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for chat_groups
DROP POLICY IF EXISTS "Anyone can select core groups, members can select custom/dms" ON public.chat_groups;
CREATE POLICY "Anyone can select core groups, members can select custom/dms"
ON public.chat_groups FOR SELECT
TO public
USING (
    is_core = true 
    OR EXISTS (
        SELECT 1 FROM public.chat_group_members 
        WHERE group_id = id AND user_id = auth.uid() AND status = 'joined'
    )
    OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can create custom groups or DMs" ON public.chat_groups;
CREATE POLICY "Authenticated users can create custom groups or DMs"
ON public.chat_groups FOR INSERT
TO authenticated
WITH CHECK (
    type IN ('custom', 'dm') 
    AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Creators can delete their custom groups" ON public.chat_groups;
CREATE POLICY "Creators can delete their custom groups"
ON public.chat_groups FOR DELETE
TO authenticated
USING (
    is_core = false 
    AND created_by = auth.uid()
);

-- 11. RLS Policies for chat_group_members
DROP POLICY IF EXISTS "Members can select membership records" ON public.chat_group_members;
CREATE POLICY "Members can select membership records"
ON public.chat_group_members FOR SELECT
TO public
USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.chat_group_members 
        WHERE group_id = chat_group_members.group_id AND user_id = auth.uid() AND status = 'joined'
    )
);

DROP POLICY IF EXISTS "Creators can add members, users can invite themselves" ON public.chat_group_members;
CREATE POLICY "Creators can add members, users can invite themselves"
ON public.chat_group_members FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_groups 
        WHERE id = group_id AND (created_by = auth.uid() OR type = 'dm')
    )
    OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own status" ON public.chat_group_members;
CREATE POLICY "Users can update their own status"
ON public.chat_group_members FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Creators or users can delete custom group memberships" ON public.chat_group_members;
CREATE POLICY "Creators or users can delete custom group memberships"
ON public.chat_group_members FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.chat_groups 
        WHERE id = group_id AND created_by = auth.uid()
    )
);

-- 12. Update Messages RLS select policy to check membership
DROP POLICY IF EXISTS "Select messages if member of group" ON public.messages;
CREATE POLICY "Select messages if member of group"
ON public.messages FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.chat_groups g
        WHERE g.id = group_id
        AND (
            g.is_core = true
            OR EXISTS (
                SELECT 1 FROM public.chat_group_members m
                WHERE m.group_id = g.id AND m.user_id = auth.uid() AND m.status = 'joined'
            )
        )
    )
);

DROP POLICY IF EXISTS "Insert messages if member of group" ON public.messages;
CREATE POLICY "Insert messages if member of group"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_groups g
        WHERE g.id = group_id
        AND (
            g.is_core = true
            OR EXISTS (
                SELECT 1 FROM public.chat_group_members m
                WHERE m.group_id = g.id AND m.user_id = auth.uid() AND m.status = 'joined'
            )
        )
    )
    AND user_id = auth.uid()
);

-- 13. Storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated and anonymous upload of chat images" ON storage.objects;
CREATE POLICY "Allow authenticated and anonymous upload of chat images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "Allow public read of chat images" ON storage.objects;
CREATE POLICY "Allow public read of chat images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-images');

-- 14. Add tables to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;

-- 15. Purge expired groups and DMs cron job update
-- Note: general, game_analysis, dm messages disappear after 24 hrs
-- Bugs & features and Custom Groups do not expire.
CREATE OR REPLACE FUNCTION public.purge_expired_chat_messages()
RETURNS void AS $$
BEGIN
    -- Delete expired chat messages (24h limit for general, game_analysis, dm)
    DELETE FROM public.messages 
    WHERE created_at < now() - INTERVAL '24 hours'
      AND group_id IN (
          SELECT id FROM public.chat_groups 
          WHERE type IN ('general', 'game_analysis', 'dm')
      );
      
    -- Delete expired chat images from storage matching general, game_analysis, dm
    -- We can delete objects older than 24 hours in 'chat-images' bucket
    DELETE FROM storage.objects 
    WHERE bucket_id = 'chat-images' 
      AND created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cron job to run hourly
SELECT cron.unschedule('purge-expired-voice-notes'); -- unschedule old cleanups if needed
SELECT cron.schedule(
    'purge-expired-voice-notes-and-chats',
    '0 * * * *', -- Every hour on the hour
    'SELECT public.purge_expired_chat_messages();'
);
