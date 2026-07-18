-- Add is_edited and is_deleted columns to guess_comments
ALTER TABLE public.guess_comments ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.guess_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create comment_reactions table
CREATE TABLE IF NOT EXISTS public.comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.guess_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(comment_id, user_id)
);

-- Enable RLS on comment_reactions
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for comment_reactions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view comment reactions') THEN
        CREATE POLICY "Anyone can view comment reactions" ON public.comment_reactions FOR SELECT USING (TRUE);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage their own comment reactions') THEN
        CREATE POLICY "Authenticated users can manage their own comment reactions" ON public.comment_reactions 
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Enable Realtime for comment_reactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comment_reactions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;
    END IF;
END $$;
