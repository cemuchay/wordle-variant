CREATE TABLE IF NOT EXISTS public.wordup_async_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    player1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    questions JSONB,
    encryption_key TEXT,
    current_question_index INTEGER DEFAULT 0 NOT NULL,
    p1_score INTEGER DEFAULT 0 NOT NULL,
    p2_score INTEGER DEFAULT 0 NOT NULL,
    p1_answers JSONB DEFAULT '[]'::jsonb,
    p2_answers JSONB DEFAULT '[]'::jsonb,
    p1_answered BOOLEAN DEFAULT FALSE,
    p2_answered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.wordup_async_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Async matches are viewable by everyone"
ON public.wordup_async_matches FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Users can insert async matches" ON public.wordup_async_matches;

CREATE POLICY "Anyone can insert async matches"
ON public.wordup_async_matches FOR INSERT
TO authenticated, anon
WITH CHECK (
  auth.uid() = player1_id OR
  auth.uid() = player2_id OR
  (player1_id IN (SELECT id FROM guest_profiles))
);

CREATE POLICY "Users can update async matches they participate in"
ON public.wordup_async_matches FOR UPDATE
TO authenticated
USING (auth.uid() = player1_id OR auth.uid() = player2_id)
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.wordup_async_matches;
