-- 60_wordup_schema.sql

-- 1. Create wordup_profiles table
CREATE TABLE IF NOT EXISTS public.wordup_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER DEFAULT 1200 NOT NULL,
    xp INTEGER DEFAULT 0 NOT NULL,
    games_played INTEGER DEFAULT 0 NOT NULL,
    games_won INTEGER DEFAULT 0 NOT NULL,
    games_lost INTEGER DEFAULT 0 NOT NULL,
    games_tied INTEGER DEFAULT 0 NOT NULL,
    rank_name VARCHAR(50) DEFAULT 'Bronze' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create wordup_queue table
CREATE TABLE IF NOT EXISTS public.wordup_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create wordup_matches table
CREATE TABLE IF NOT EXISTS public.wordup_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    player1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_bot_match BOOLEAN DEFAULT FALSE,
    bot_profile VARCHAR(50), -- 'slow_thinker', 'average', 'fast', 'master', 'impossible'
    status VARCHAR(20) DEFAULT 'waiting' NOT NULL, -- 'waiting', 'countdown', 'active', 'completed', 'abandoned'
    questions JSONB, -- Encrypted JSON array of 7 questions
    encryption_key TEXT, -- Secret key used to decrypt questions
    current_question_index INTEGER DEFAULT 0 NOT NULL,
    p1_score INTEGER DEFAULT 0 NOT NULL,
    p2_score INTEGER DEFAULT 0 NOT NULL,
    p1_answers JSONB DEFAULT '[]'::jsonb, -- Array of { question_idx, correct, time_taken, points }
    p2_answers JSONB DEFAULT '[]'::jsonb, -- Array of { question_idx, correct, time_taken, points }
    p1_answered BOOLEAN DEFAULT FALSE,
    p2_answered BOOLEAN DEFAULT FALSE,
    question_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. Enable RLS
ALTER TABLE public.wordup_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordup_matches ENABLE ROW LEVEL SECURITY;

-- 5. Policies for wordup_profiles
CREATE POLICY "WordUp profiles are viewable by everyone"
ON public.wordup_profiles FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can update their own WordUp profile"
ON public.wordup_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policies for wordup_queue
CREATE POLICY "Queue is viewable by authenticated users"
ON public.wordup_queue FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can join queue"
ON public.wordup_queue FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave/delete from queue"
ON public.wordup_queue FOR DELETE
TO authenticated
USING (true);

-- Policies for wordup_matches
CREATE POLICY "Matches are viewable by everyone"
ON public.wordup_matches FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can insert matches"
ON public.wordup_matches FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can update matches they participate in"
ON public.wordup_matches FOR UPDATE
TO authenticated
USING (auth.uid() = player1_id OR auth.uid() = player2_id OR is_bot_match)
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id OR is_bot_match);

-- 6. Trigger to automatically create a WordUp profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_wordup_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wordup_profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created_wordup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_wordup_profile();

-- 7. Backfill existing profiles
INSERT INTO public.wordup_profiles (id)
SELECT id FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- 8. Add Matchmaking Stored Procedure
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
    AND status IN ('waiting', 'countdown', 'active')
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

    -- Create new match
    INSERT INTO public.wordup_matches (category, player1_id, player2_id, status)
    VALUES (p_category, v_opponent_id, p_user_id, 'waiting')
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

-- 9. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.wordup_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wordup_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wordup_profiles;
