-- 103_fix_wordup_countdown_sync.sql
-- Sets question_started_at at match creation time so both players use the same
-- server-authoritative countdown timestamp, eliminating the desync where the match
-- creator sees a full 3-2-1 countdown while the opponent sees only "3".

CREATE OR REPLACE FUNCTION public.join_wordup_queue(p_user_id UUID, p_category VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_match_id UUID;
  v_opponent_id UUID;
  v_match_record RECORD;
BEGIN
  -- 1. Check if user is already in an active/countdown match
  SELECT * INTO v_match_record
  FROM public.wordup_matches
  WHERE (player1_id = p_user_id OR player2_id = p_user_id)
    AND (
      status IN ('countdown') OR
      (status = 'active' AND ((player1_id = p_user_id AND p1_answered = FALSE) OR (player2_id = p_user_id AND p2_answered = FALSE))) OR
      (status = 'waiting' AND questions IS NULL)
    )
  LIMIT 1;

  IF v_match_record.id IS NOT NULL THEN
    RETURN jsonb_build_object('match_id', v_match_record.id, 'status', v_match_record.status);
  END IF;

  -- 2. Try to find an opponent in the queue for the same category
  SELECT user_id INTO v_opponent_id
  FROM public.wordup_queue
  WHERE category = p_category AND user_id != p_user_id
  ORDER BY joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent_id IS NOT NULL THEN
    -- Match found! Delete opponent from queue
    DELETE FROM public.wordup_queue WHERE user_id = v_opponent_id;
    DELETE FROM public.wordup_queue WHERE user_id = p_user_id;

    -- Create new match with question_started_at set at DB level so both
    -- players use the same server-authoritative countdown timestamp.
    INSERT INTO public.wordup_matches (category, player1_id, player2_id, status, game_type, question_started_at)
    VALUES (p_category, v_opponent_id, p_user_id, 'waiting', 'live', NOW() + INTERVAL '5 seconds')
    RETURNING id, status INTO v_match_id, v_match_record.status;

    RETURN jsonb_build_object('match_id', v_match_id, 'status', v_match_record.status, 'role', 'player2');
  ELSE
    -- No opponent found, put user in queue
    INSERT INTO public.wordup_queue (user_id, category, joined_at)
    VALUES (p_user_id, p_category, NOW())
    ON CONFLICT (user_id) DO UPDATE SET category = p_category, joined_at = NOW();

    RETURN jsonb_build_object('match_id', NULL, 'status', 'queued', 'role', 'player1');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
