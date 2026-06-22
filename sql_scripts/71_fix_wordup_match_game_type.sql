-- 71_fix_wordup_match_game_type.sql
-- Fix matchmade PvP games being incorrectly resolved as "async" instead of "live".
-- The join_wordup_queue RPC creates matches without game_type, causing Player1's
-- game type resolver to fall through to status='waiting' → resolves as "async".
-- Adding game_type='live' ensures the live game hook is used (with real-time channels).

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
    -- Delete self if in queue
    DELETE FROM public.wordup_queue WHERE user_id = p_user_id;

    -- Create new match (game_type='live' for real-time PvP)
    INSERT INTO public.wordup_matches (category, player1_id, player2_id, status, game_type)
    VALUES (p_category, v_opponent_id, p_user_id, 'waiting', 'live')
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
