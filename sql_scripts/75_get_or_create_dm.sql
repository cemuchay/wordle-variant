-- 75_get_or_create_dm.sql
-- Atomic DM room creation: checks for existing DM or creates one in a single roundtrip.

CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_partner_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_dm_key TEXT;
    v_existing_id UUID;
    v_new_group_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_partner_id = v_user_id THEN
        RAISE EXCEPTION 'Cannot create DM with yourself';
    END IF;

    v_dm_key := array_to_string(ARRAY[v_user_id, p_partner_id] ORDER BY 1, ':');

    -- Check if DM already exists
    SELECT id INTO v_existing_id
    FROM public.chat_groups
    WHERE dm_key = v_dm_key AND type = 'dm'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Ensure the caller is a member (could have been removed)
        INSERT INTO public.chat_group_members (group_id, user_id, status)
        VALUES (v_existing_id, v_user_id, 'joined')
        ON CONFLICT (group_id, user_id) DO NOTHING;
        RETURN v_existing_id;
    END IF;

    -- Create new DM group
    INSERT INTO public.chat_groups (name, type, created_by)
    VALUES ('Direct Message', 'dm', v_user_id)
    RETURNING id INTO v_new_group_id;

    -- Add both members (the dm_key trigger on chat_group_members will auto-populate dm_key)
    INSERT INTO public.chat_group_members (group_id, user_id, status)
    VALUES
        (v_new_group_id, v_user_id, 'joined'),
        (v_new_group_id, p_partner_id, 'joined');

    RETURN v_new_group_id;
END;
$$;
