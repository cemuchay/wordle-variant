-- 45_unique_dms.sql
-- Ensure DMs between two people are unique by adding a dm_key column and cleaning up duplicates.

-- 1. Add dm_key column to chat_groups
ALTER TABLE public.chat_groups ADD COLUMN IF NOT EXISTS dm_key TEXT;

-- 2. Cleanup existing duplicates and prepare for UNIQUE constraint
DO $$
DECLARE
    r RECORD;
BEGIN
    -- For each pair of users that have DM groups, find all their shared DM groups
    FOR r IN (
        SELECT member_ids, array_agg(group_id ORDER BY created_at) as group_ids
        FROM (
            SELECT g.id as group_id, g.created_at,
                   array_agg(gm.user_id ORDER BY gm.user_id) as member_ids
            FROM public.chat_group_members gm
            JOIN public.chat_groups g ON g.id = gm.group_id
            WHERE g.type = 'dm'
            GROUP BY g.id, g.created_at
        ) sub
        GROUP BY member_ids
        HAVING count(*) > 1
    ) LOOP
        -- r.group_ids[1] is the one to keep (oldest)
        -- The rest are duplicates to delete
        
        -- Move messages
        UPDATE public.messages 
        SET group_id = r.group_ids[1]
        WHERE group_id = ANY(r.group_ids[2:array_length(r.group_ids, 1)]);
        
        -- Delete members of duplicate groups (FK safety)
        DELETE FROM public.chat_group_members
        WHERE group_id = ANY(r.group_ids[2:array_length(r.group_ids, 1)]);
        
        -- Delete duplicate groups
        DELETE FROM public.chat_groups
        WHERE id = ANY(r.group_ids[2:array_length(r.group_ids, 1)]);
    END LOOP;
END $$;

-- 3. Populate dm_key for all existing DMs
UPDATE public.chat_groups g
SET dm_key = (
    SELECT array_to_string(array_agg(user_id ORDER BY user_id), ':')
    FROM public.chat_group_members gm
    WHERE gm.group_id = g.id
)
WHERE g.type = 'dm';

-- 4. Add a partial unique index to enforce uniqueness only for DM groups (NULLs in non-DMs are fine)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dm_key ON public.chat_groups (dm_key) WHERE type = 'dm';

-- 5. Add a trigger to prevent adding more than 2 members to a DM group
CREATE OR REPLACE FUNCTION public.check_dm_member_count()
RETURNS TRIGGER AS $$
DECLARE
    member_count INTEGER;
    group_type TEXT;
BEGIN
    SELECT type INTO group_type FROM public.chat_groups WHERE id = NEW.group_id;

    IF group_type = 'dm' THEN
        SELECT count(*) INTO member_count FROM public.chat_group_members WHERE group_id = NEW.group_id;
        IF member_count >= 2 THEN
            RAISE EXCEPTION 'Direct Messages can only have 2 members.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_dm_member_count ON public.chat_group_members;
CREATE TRIGGER trigger_check_dm_member_count
BEFORE INSERT ON public.chat_group_members
FOR EACH ROW
EXECUTE FUNCTION public.check_dm_member_count();

-- 6. Add a trigger to automatically set dm_key when members are added to a DM
CREATE OR REPLACE FUNCTION public.update_dm_key_on_member_change()
RETURNS TRIGGER AS $$
DECLARE
    group_type TEXT;
    computed_key TEXT;
BEGIN
    SELECT type INTO group_type FROM public.chat_groups WHERE id = NEW.group_id;

    IF group_type = 'dm' THEN
        SELECT array_to_string(array_agg(user_id ORDER BY user_id), ':')
        INTO computed_key
        FROM public.chat_group_members
        WHERE group_id = NEW.group_id;

        UPDATE public.chat_groups SET dm_key = computed_key WHERE id = NEW.group_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dm_key ON public.chat_group_members;
CREATE TRIGGER trigger_update_dm_key
AFTER INSERT ON public.chat_group_members
FOR EACH ROW
EXECUTE FUNCTION public.update_dm_key_on_member_change();

-- 7. Add a trigger to update dm_key when a member is removed from a DM
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
        
        IF remaining_count > 0 THEN
            SELECT array_to_string(array_agg(user_id ORDER BY user_id), ':')
            INTO computed_key
            FROM public.chat_group_members
            WHERE group_id = OLD.group_id;
            
            UPDATE public.chat_groups SET dm_key = computed_key WHERE id = OLD.group_id;
        ELSE
            -- No members left; set dm_key to NULL (partial index ignores NULLs)
            UPDATE public.chat_groups SET dm_key = NULL WHERE id = OLD.group_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dm_key_on_removal ON public.chat_group_members;
CREATE TRIGGER trigger_update_dm_key_on_removal
AFTER DELETE ON public.chat_group_members
FOR EACH ROW
EXECUTE FUNCTION public.update_dm_key_on_member_removal();