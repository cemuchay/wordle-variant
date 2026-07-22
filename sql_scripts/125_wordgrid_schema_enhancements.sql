-- 125_wordgrid_schema_enhancements.sql

-- 1. Add missing dynamic grid size, max players, players_data, and turn index columns to wordgrid_matches
ALTER TABLE public.wordgrid_matches
  ADD COLUMN IF NOT EXISTS grid_size INTEGER DEFAULT 7 NOT NULL,
  ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 2 NOT NULL,
  ADD COLUMN IF NOT EXISTS players_data JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS current_turn_index INTEGER DEFAULT 0 NOT NULL;

-- 2. Add grid_size and max_players to wordgrid_queue
ALTER TABLE public.wordgrid_queue
  ADD COLUMN IF NOT EXISTS grid_size INTEGER DEFAULT 7 NOT NULL,
  ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 2 NOT NULL;

-- 3. Update join_wordgrid_queue stored procedure to support dynamic parameters
CREATE OR REPLACE FUNCTION public.join_wordgrid_queue(
  p_user_id UUID,
  p_is_rated BOOLEAN,
  p_grid_size INTEGER DEFAULT 7,
  p_max_players INTEGER DEFAULT 2
)
RETURNS JSONB AS $$
DECLARE
  v_match_id UUID;
  v_opponent_id UUID;
  v_match_record RECORD;
BEGIN
  -- 1. Check if user is already in an active match
  SELECT * INTO v_match_record
  FROM public.wordgrid_matches
  WHERE (player1_id = p_user_id OR player2_id = p_user_id)
    AND status = 'active'
  LIMIT 1;

  IF v_match_record.id IS NOT NULL THEN
    RETURN jsonb_build_object('match_id', v_match_record.id, 'status', v_match_record.status);
  END IF;

  -- 2. Try to find an opponent in the queue with matching parameters
  SELECT user_id INTO v_opponent_id
  FROM public.wordgrid_queue
  WHERE is_rated = p_is_rated
    AND grid_size = p_grid_size
    AND user_id != p_user_id
  ORDER BY joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent_id IS NOT NULL THEN
    -- Match found! Delete opponent and self from queue
    DELETE FROM public.wordgrid_queue WHERE user_id = v_opponent_id;
    DELETE FROM public.wordgrid_queue WHERE user_id = p_user_id;

    -- Create new match
    INSERT INTO public.wordgrid_matches (
      player1_id,
      player2_id,
      is_rated,
      grid_size,
      max_players,
      status,
      current_turn
    )
    VALUES (
      v_opponent_id,
      p_user_id,
      p_is_rated,
      p_grid_size,
      p_max_players,
      'active',
      v_opponent_id
    )
    RETURNING id, status INTO v_match_id, v_match_record.status;

    RETURN jsonb_build_object('match_id', v_match_id, 'status', v_match_record.status, 'role', 'player2');
  ELSE
    -- No opponent found, put user in queue
    INSERT INTO public.wordgrid_queue (user_id, is_rated, grid_size, max_players, joined_at)
    VALUES (p_user_id, p_is_rated, p_grid_size, p_max_players, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      is_rated = p_is_rated,
      grid_size = p_grid_size,
      max_players = p_max_players,
      joined_at = NOW();

    RETURN jsonb_build_object('match_id', NULL, 'status', 'queued', 'role', 'player1');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
