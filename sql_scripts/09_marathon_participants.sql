-- Create Challenge Participants Marathon Table
CREATE TABLE IF NOT EXISTS public.challenge_participants_marathon (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id UUID REFERENCES public.challenge_participants(id) ON DELETE CASCADE NOT NULL,
    word_length INTEGER NOT NULL CHECK (word_length >= 3 AND word_length <= 7),
    status VARCHAR(20) NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'completed', 'timed_out')),
    score INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    guesses JSONB DEFAULT '[]'::jsonb,
    hints_used BOOLEAN DEFAULT FALSE,
    hint_record JSONB DEFAULT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(participation_id, word_length)
);

-- Enable RLS
ALTER TABLE public.challenge_participants_marathon ENABLE ROW LEVEL SECURITY;

-- Policies for Challenge Participants Marathon
CREATE POLICY "Marathon participants are viewable by all authenticated users"
ON public.challenge_participants_marathon FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own marathon progress"
ON public.challenge_participants_marathon FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.challenge_participants
        WHERE id = participation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own marathon progress"
ON public.challenge_participants_marathon FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.challenge_participants
        WHERE id = participation_id AND user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.challenge_participants
        WHERE id = participation_id AND user_id = auth.uid()
    )
);

-- Realtime settings
-- Note: You might need to check if the publication exists or use a different method 
-- if your Supabase setup is different, but this is the standard way.
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants_marathon;
