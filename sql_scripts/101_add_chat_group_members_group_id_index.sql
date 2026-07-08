-- 101_add_chat_group_members_group_id_index.sql
-- Add index on chat_group_members.group_id to speed up DM key trigger lookups.
-- The trigger update_dm_key_on_member_change uses:
--   SELECT array_agg(user_id ORDER BY user_id)
--   FROM public.chat_group_members
--   WHERE group_id = NEW.group_id;
-- Without an index on group_id, this scan is O(n) across the entire table.

CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id 
ON public.chat_group_members (group_id);
