-- 123_wordgrid_schema.sql

-- 1. Create wordgrid_profiles table
CREATE TABLE IF NOT EXISTS public.wordgrid_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER DEFAULT 1200 NOT NULL,
    xp INTEGER DEFAULT 0 NOT NULL,
    games_played INTEGER DEFAULT 0 NOT NULL,
    games_won INTEGER DEFAULT 0 NOT NULL,
    games_lost INTEGER DEFAULT 0 NOT NULL,
    games_tied INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create wordgrid_queue table
CREATE TABLE IF NOT EXISTS public.wordgrid_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    is_rated BOOLEAN DEFAULT FALSE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create wordgrid_matches table
CREATE TABLE IF NOT EXISTS public.wordgrid_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'waiting' NOT NULL, -- 'waiting', 'active', 'completed', 'abandoned'
    is_rated BOOLEAN DEFAULT FALSE NOT NULL,
    board JSONB DEFAULT '[]'::jsonb NOT NULL, -- list of placed cells {x, y, letter, score, owner_id}
    tile_bag JSONB DEFAULT '[]'::jsonb NOT NULL, -- remaining tiles
    p1_rack JSONB DEFAULT '[]'::jsonb NOT NULL,
    p2_rack JSONB DEFAULT '[]'::jsonb NOT NULL,
    current_turn UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    p1_score INTEGER DEFAULT 0 NOT NULL,
    p2_score INTEGER DEFAULT 0 NOT NULL,
    moves JSONB DEFAULT '[]'::jsonb NOT NULL, -- array of moves
    consecutive_passes INTEGER DEFAULT 0 NOT NULL,
    is_bot_match BOOLEAN DEFAULT FALSE NOT NULL,
    bot_difficulty VARCHAR(20) DEFAULT 'normal' NOT NULL,
    turn_limit_minutes INTEGER,
    last_move_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. Enable RLS
ALTER TABLE public.wordgrid_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordgrid_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordgrid_matches ENABLE ROW LEVEL SECURITY;

-- 5. Policies for wordgrid_profiles
CREATE POLICY "WordGrid profiles are viewable by everyone"
ON public.wordgrid_profiles FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can update their own WordGrid profile"
ON public.wordgrid_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policies for wordgrid_queue
CREATE POLICY "Queue is viewable by authenticated users"
ON public.wordgrid_queue FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can join queue"
ON public.wordgrid_queue FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave/delete from queue"
ON public.wordgrid_queue FOR DELETE
TO authenticated
USING (true);

-- Policies for wordgrid_matches
CREATE POLICY "Matches are viewable by everyone"
ON public.wordgrid_matches FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can insert matches"
ON public.wordgrid_matches FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can update matches they participate in"
ON public.wordgrid_matches FOR UPDATE
TO authenticated
USING (auth.uid() = player1_id OR auth.uid() = player2_id OR is_bot_match)
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id OR is_bot_match);

-- 6. Trigger to automatically create a WordGrid profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_wordgrid_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wordgrid_profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created_wordgrid
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_wordgrid_profile();

-- 7. Backfill existing profiles
INSERT INTO public.wordgrid_profiles (id)
SELECT id FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- 8. Add Matchmaking Stored Procedure
CREATE OR REPLACE FUNCTION public.join_wordgrid_queue(p_user_id UUID, p_is_rated BOOLEAN)
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

  -- 2. Try to find an opponent in the queue
  SELECT user_id INTO v_opponent_id
  FROM public.wordgrid_queue
  WHERE is_rated = p_is_rated AND user_id != p_user_id
  ORDER BY joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent_id IS NOT NULL THEN
    -- Match found! Delete opponent and self from queue
    DELETE FROM public.wordgrid_queue WHERE user_id = v_opponent_id;
    DELETE FROM public.wordgrid_queue WHERE user_id = p_user_id;

    -- Create new match
    INSERT INTO public.wordgrid_matches (player1_id, player2_id, is_rated, status, current_turn)
    VALUES (v_opponent_id, p_user_id, p_is_rated, 'active', v_opponent_id)
    RETURNING id, status INTO v_match_id, v_match_record.status;

    RETURN jsonb_build_object('match_id', v_match_id, 'status', v_match_record.status, 'role', 'player2');
  ELSE
    -- No opponent found, put user in queue
    INSERT INTO public.wordgrid_queue (user_id, is_rated, joined_at)
    VALUES (p_user_id, p_is_rated, NOW())
    ON CONFLICT (user_id) DO UPDATE SET is_rated = p_is_rated, joined_at = NOW();

    RETURN jsonb_build_object('match_id', NULL, 'status', 'queued', 'role', 'player1');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.wordgrid_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wordgrid_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wordgrid_profiles;
