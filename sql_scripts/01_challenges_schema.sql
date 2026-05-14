-- Create Challenges Table
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.profiles(id) NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('LIVE', 'ANYTIME')),
    word_length INTEGER NOT NULL CHECK (word_length >= 3 AND word_length <= 7),
    target_word VARCHAR(10) NOT NULL,
    salt VARCHAR(50) DEFAULT '',
    max_time INTEGER, -- In minutes, for LIVE mode
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Challenge Participants Table
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'completed', 'declined', 'timed_out')),
    score INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    guesses JSONB DEFAULT '[]'::jsonb,
    hints_used BOOLEAN DEFAULT FALSE,
    hint_record JSONB DEFAULT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(challenge_id, user_id)
);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- Policies for Challenges
CREATE POLICY "Challenges are viewable by all authenticated users"
ON public.challenges FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create challenges"
ON public.challenges FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

-- Policies for Challenge Participants
CREATE POLICY "Participants are viewable by all authenticated users"
ON public.challenge_participants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can join challenges"
ON public.challenge_participants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation status"
ON public.challenge_participants FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Realtime settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants;
