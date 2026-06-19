-- 64_fix_matchmaking_async_stale.sql
-- Fix: join_wordup_queue should not return stale async/waiting matches 
-- where the user has already played their turn. Also ensures search opponent
-- always creates fresh live games.

CREATE OR REPLACE FUNCTION public.join_wordup_queue(p_user_id UUID, p_category VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_match_id UUID;
  v_opponent_id UUID;
  v_match_record RECORD;
BEGIN
  -- Check if user is already in an active/countdown/waiting-live match
  -- For async waiting matches, only return if user hasn't played their turn yet
  SELECT * INTO v_match_record
  FROM public.wordup_matches
  WHERE (player1_id = p_user_id OR player2_id = p_user_id)
    AND (
      status IN ('countdown', 'active')
      OR (status = 'waiting' AND (game_type IS NULL OR game_type = 'live'))
      OR (status = 'waiting' AND game_type = 'async' AND (
        (player1_id = p_user_id AND COALESCE(p1_answered, FALSE) = FALSE)
        OR (player2_id = p_user_id AND COALESCE(p2_answered, FALSE) = FALSE)
      ))
    )
  LIMIT 1;

  IF v_match_record.id IS NOT NULL THEN
    RETURN jsonb_build_object('match_id', v_match_record.id, 'status', v_match_record.status);
  END IF;

  SELECT user_id INTO v_opponent_id
  FROM public.wordup_queue
  WHERE category = p_category AND user_id != p_user_id
  ORDER BY joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent_id IS NOT NULL THEN
    DELETE FROM public.wordup_queue WHERE user_id = v_opponent_id;
    DELETE FROM public.wordup_queue WHERE user_id = p_user_id;

    INSERT INTO public.wordup_matches (category, player1_id, player2_id, status, game_type)
    VALUES (p_category, v_opponent_id, p_user_id, 'waiting', 'live')
    RETURNING id, status INTO v_match_id, v_match_record.status;

    RETURN jsonb_build_object('match_id', v_match_id, 'status', v_match_record.status, 'role', 'player2');
  ELSE
    INSERT INTO public.wordup_queue (user_id, category, joined_at)
    VALUES (p_user_id, p_category, NOW())
    ON CONFLICT (user_id) DO UPDATE SET category = p_category, joined_at = NOW();

    RETURN jsonb_build_object('match_id', NULL, 'status', 'queued', 'role', 'player1');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
