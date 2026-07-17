CREATE OR REPLACE FUNCTION join_challenge_safely(
    p_challenge_id UUID,
    p_user_id UUID,
    p_is_guest BOOLEAN
) 
RETURNS SETOF challenge_participants 
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing challenge_participants;
    v_challenge challenges;
    v_current_count INT;
    v_inserted challenge_participants;
BEGIN
    -- 1. Check if already participating (Instant Return)
    IF p_is_guest THEN
        SELECT * INTO v_existing FROM challenge_participants 
        WHERE challenge_id = p_challenge_id AND guest_id = p_user_id LIMIT 1;
    ELSE
        SELECT * INTO v_existing FROM challenge_participants 
        WHERE challenge_id = p_challenge_id AND user_id = p_user_id LIMIT 1;
    END IF;

    IF FOUND THEN
        RETURN NEXT v_existing;
        RETURN;
    END IF;

    -- 2. Lock the challenge row (Prevents Race Conditions)
    SELECT * INTO v_challenge FROM challenges 
    WHERE id = p_challenge_id 
    FOR UPDATE; 

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found.';
    END IF;

    -- 3. Permission Check
    IF NOT v_challenge.is_public AND NOT v_challenge.is_bot_marathon AND v_challenge.creator_id != p_user_id THEN
        RAISE EXCEPTION 'This is a private challenge. You must be invited to join.';
    END IF;

    -- 4. Safe Participant Count Check
    SELECT COUNT(*) INTO v_current_count FROM challenge_participants 
    WHERE challenge_id = p_challenge_id;

    IF v_current_count >= COALESCE(v_challenge.max_participants, 100) THEN
        RAISE EXCEPTION 'Challenge participant limit reached.';
    END IF;

    -- 5. Safe Insert
    IF p_is_guest THEN
        INSERT INTO challenge_participants (challenge_id, guest_id, status)
        VALUES (p_challenge_id, p_user_id, 'pending')
        RETURNING * INTO v_inserted;
    ELSE
        INSERT INTO challenge_participants (challenge_id, user_id, status)
        VALUES (p_challenge_id, p_user_id, 'pending')
        RETURNING * INTO v_inserted;
    END IF;

    RETURN NEXT v_inserted;
    RETURN;
END;
$$;