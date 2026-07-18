-- 119_follows_comments_reactions.sql

-- 1. Alter profiles table to add comments_disabled column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN DEFAULT FALSE;

-- 2. Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

-- Enable RLS on follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for follows
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view follows') THEN
        CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can follow others') THEN
        CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can unfollow others') THEN
        CREATE POLICY "Users can unfollow others" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
    END IF;
END $$;

-- 3. Create guess_comments table
CREATE TABLE IF NOT EXISTS public.guess_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_date VARCHAR(50) NOT NULL,
    guess_index INTEGER NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on guess_comments
ALTER TABLE public.guess_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for guess_comments
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read comments on allowed profiles') THEN
        CREATE POLICY "Anyone can read comments on allowed profiles" ON public.guess_comments FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = target_user_id AND COALESCE(comments_disabled, FALSE) = FALSE
            )
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can post comments') THEN
        CREATE POLICY "Authenticated users can post comments" ON public.guess_comments FOR INSERT 
        WITH CHECK (
            auth.uid() = author_id AND
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = target_user_id AND COALESCE(comments_disabled, FALSE) = FALSE
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own comments') THEN
        CREATE POLICY "Users can delete own comments" ON public.guess_comments FOR DELETE 
        USING (auth.uid() = author_id OR auth.uid() = target_user_id);
    END IF;
END $$;

-- 4. Create guess_reactions table
CREATE TABLE IF NOT EXISTS public.guess_reactions (
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_date VARCHAR(50) NOT NULL,
    guess_index INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (target_user_id, game_date, guess_index, user_id)
);

-- Enable RLS on guess_reactions
ALTER TABLE public.guess_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for guess_reactions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view guess reactions') THEN
        CREATE POLICY "Anyone can view guess reactions" ON public.guess_reactions FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can react to guesses') THEN
        CREATE POLICY "Users can react to guesses" ON public.guess_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own reaction') THEN
        CREATE POLICY "Users can update own reaction" ON public.guess_reactions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can remove own reaction') THEN
        CREATE POLICY "Users can remove own reaction" ON public.guess_reactions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Trigger for Followee Activity Notifications (Start / Finish playing)
CREATE OR REPLACE FUNCTION public.handle_followee_activity()
RETURNS TRIGGER AS $$
DECLARE
    followee_username VARCHAR;
    r RECORD;
    msg_str TEXT;
    title_str TEXT;
    notif_type VARCHAR(50);
BEGIN
    -- Get followee username
    SELECT username INTO followee_username FROM public.profiles WHERE id = NEW.user_id;
    followee_username := COALESCE(followee_username, 'Someone');

    -- Check if status transitioned to playing
    IF (TG_OP = 'INSERT' AND NEW.status = 'playing') OR (TG_OP = 'UPDATE' AND OLD.status != 'playing' AND NEW.status = 'playing') THEN
        notif_type := 'FOLLOWEE_STARTED_PLAYING';
        title_str := 'Started Playing';
        msg_str := followee_username || ' has started playing today''s Variant!';
        
        FOR r IN (SELECT follower_id FROM public.follows WHERE following_id = NEW.user_id) LOOP
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (r.follower_id, notif_type, title_str, msg_str, jsonb_build_object('followed_id', NEW.user_id, 'game_date', NEW.game_date));
        END LOOP;
    ELSIF (NEW.status IN ('won', 'lost')) AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') NOT IN ('won', 'lost'))) THEN
        notif_type := 'FOLLOWEE_FINISHED_PLAYING';
        title_str := 'Finished Playing';
        IF NEW.status = 'won' THEN
            msg_str := followee_username || ' finished today''s Variant in ' || NEW.attempts || ' attempts (' || NEW.skill_score || ' pts)!';
        ELSE
            msg_str := followee_username || ' failed today''s Variant (' || NEW.skill_score || ' pts)!';
        END IF;

        FOR r IN (SELECT follower_id FROM public.follows WHERE following_id = NEW.user_id) LOOP
            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (r.follower_id, notif_type, title_str, msg_str, jsonb_build_object('followed_id', NEW.user_id, 'game_date', NEW.game_date, 'status', NEW.status, 'attempts', NEW.attempts, 'score', NEW.skill_score));
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_followee_activity ON public.scores;
CREATE TRIGGER trigger_followee_activity
AFTER INSERT OR UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.handle_followee_activity();

-- 6. Add all to Supabase Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'follows') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'guess_comments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.guess_comments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'guess_reactions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.guess_reactions;
    END IF;
END $$;
