-- 98_chat_read_receipts_rls.sql
-- 1. Drop the old read receipt policy and create a new one that allows group members to view read receipts of other members.
DROP POLICY IF EXISTS "Users can view their own read receipts" ON public.chat_read_receipts;
CREATE POLICY "Group members can view read receipts"
ON public.chat_read_receipts FOR SELECT
TO public
USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
);

-- 2. Update trigger functions to only compute and set dm_key when there are exactly 2 members in the DM group.
-- This avoids unique constraint collisions on single-member temporary keys during DM creation.
CREATE OR REPLACE FUNCTION public.update_dm_key_on_member_change()
RETURNS TRIGGER AS $$
DECLARE
    group_type TEXT;
    computed_key TEXT;
    member_count INTEGER;
BEGIN
    SELECT type INTO group_type FROM public.chat_groups WHERE id = NEW.group_id;

    IF group_type = 'dm' THEN
        SELECT count(*) INTO member_count FROM public.chat_group_members WHERE group_id = NEW.group_id;
        
        IF member_count = 2 THEN
            SELECT array_to_string(array_agg(user_id ORDER BY user_id), ':')
            INTO computed_key
            FROM public.chat_group_members
            WHERE group_id = NEW.group_id;

            UPDATE public.chat_groups SET dm_key = computed_key WHERE id = NEW.group_id;
        ELSE
            -- Set to NULL to avoid constraint collisions with single member IDs
            UPDATE public.chat_groups SET dm_key = NULL WHERE id = NEW.group_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_dm_key_on_member_removal()
RETURNS TRIGGER AS $$
DECLARE
    group_type TEXT;
    computed_key TEXT;
    remaining_count INTEGER;
BEGIN
    SELECT type INTO group_type FROM public.chat_groups WHERE id = OLD.group_id;

    IF group_type = 'dm' THEN
        SELECT count(*) INTO remaining_count FROM public.chat_group_members WHERE group_id = OLD.group_id;
        
        IF remaining_count = 2 THEN
            SELECT array_to_string(array_agg(user_id ORDER BY user_id), ':')
            INTO computed_key
            FROM public.chat_group_members
            WHERE group_id = OLD.group_id;
            
            UPDATE public.chat_groups SET dm_key = computed_key WHERE id = OLD.group_id;
        ELSE
            -- No longer exactly 2 members; set dm_key to NULL
            UPDATE public.chat_groups SET dm_key = NULL WHERE id = OLD.group_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
