-- 102_cleanup_duplicate_dms.sql
-- Clean up any remaining duplicate DM groups between the same pair of users.
-- Steps:
--   1. Drop the unique index temporarily (so populating dm_key doesn't conflict)
--   2. Merge duplicate DMs by member composition
--   3. Populate dm_key for all remaining DMs
--   4. Re-create the unique index

-- Step 1: Drop unique index temporarily
DROP INDEX IF EXISTS uq_dm_key;

-- Step 2: Find and merge duplicate DMs (by identical member sets)
DO $$
DECLARE
    r RECORD;
BEGIN
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
        -- r.group_ids[1] is the oldest — keep that one

        -- Move messages from duplicate groups into the kept group
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

-- Step 3: Populate dm_key for all remaining DMs (no duplicates left, no conflicts)
UPDATE public.chat_groups g
SET dm_key = (
    SELECT array_to_string(array_agg(gm.user_id ORDER BY gm.user_id), ':')
    FROM public.chat_group_members gm
    WHERE gm.group_id = g.id
)
WHERE g.type = 'dm';

-- Step 4: Re-create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_dm_key ON public.chat_groups (dm_key) WHERE type = 'dm';
