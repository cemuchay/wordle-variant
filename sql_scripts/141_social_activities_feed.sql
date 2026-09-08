-- 141_social_activities_feed.sql
-- Creates an extensible social_activities table and backfills activities for 2026-09-06 and 2026-09-07

-- 1. Create social_activities table
CREATE TABLE IF NOT EXISTS public.social_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_date VARCHAR(50) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'daily_game',
    activity_type VARCHAR(64) NOT NULL,
    guess_index INTEGER NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    reactions_count JSONB NOT NULL DEFAULT '{}'::jsonb,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_user_activity UNIQUE (user_id, game_date, activity_type, guess_index)
);

-- 2. Indexes for fast real-time chronological feeds
CREATE INDEX IF NOT EXISTS idx_social_activities_date_created 
    ON public.social_activities (game_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_activities_category_date 
    ON public.social_activities (category, game_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_activities_user 
    ON public.social_activities (user_id, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.social_activities ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_activities' AND policyname = 'Anyone can view social activities') THEN
        CREATE POLICY "Anyone can view social activities" 
            ON public.social_activities FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_activities' AND policyname = 'Users can insert their own activities') THEN
        CREATE POLICY "Users can insert their own activities" 
            ON public.social_activities FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_activities' AND policyname = 'Users can update their own activities') THEN
        CREATE POLICY "Users can update their own activities" 
            ON public.social_activities FOR UPDATE 
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Enable Realtime on social_activities
ALTER TABLE public.social_activities REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'social_activities'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.social_activities;
        END IF;
    END IF;
END $$;

-- 5. One-time Backward Compatibility Backfill Script for 2026-09-06 and 2026-09-07
-- Reconstructs guess_submitted, hint_used, and game_won/game_lost events from scores table
DO $$
DECLARE
    score_rec RECORD;
    guess_elem JSONB;
    guess_idx INTEGER;
    cum_guesses JSONB;
    total_guesses INTEGER;
    g_timestamp TIMESTAMPTZ;
    ts_array JSONB;
    base_time TIMESTAMPTZ;
BEGIN
    FOR score_rec IN 
        SELECT 
            s.id,
            s.user_id,
            s.game_date,
            s.guesses,
            s.guess_timestamps,
            s.status,
            s.hints_used,
            s.hint_record,
            s.skill_score,
            s.created_at
        FROM public.scores s
        WHERE s.game_date IN ('2026-09-06', '2026-09-07')
          AND s.user_id IS NOT NULL
          AND s.guesses IS NOT NULL
          AND jsonb_typeof(s.guesses) = 'array'
          AND jsonb_array_length(s.guesses) > 0
    LOOP
        total_guesses := jsonb_array_length(score_rec.guesses);
        ts_array := score_rec.guess_timestamps;
        base_time := COALESCE(score_rec.created_at, timezone('utc'::text, now()));

        cum_guesses := '[]'::jsonb;
        
        -- A. Loop over each guess and record 'guess_submitted'
        FOR guess_idx IN 0..(total_guesses - 1) LOOP
            guess_elem := score_rec.guesses->guess_idx;
            cum_guesses := cum_guesses || jsonb_build_array(guess_elem);

            -- Determine timestamp for this guess
            IF ts_array IS NOT NULL AND jsonb_typeof(ts_array) = 'array' AND jsonb_array_length(ts_array) > guess_idx THEN
                BEGIN
                    -- Handle either numeric epoch or ISO timestamp strings
                    IF jsonb_typeof(ts_array->guess_idx) = 'number' THEN
                        g_timestamp := to_timestamp((ts_array->>guess_idx)::double precision / 1000.0);
                    ELSE
                        g_timestamp := (ts_array->>guess_idx)::timestamptz;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    g_timestamp := base_time - (interval '30 seconds' * (total_guesses - guess_idx));
                END;
            ELSE
                g_timestamp := base_time - (interval '30 seconds' * (total_guesses - guess_idx));
            END IF;

            INSERT INTO public.social_activities (
                user_id,
                game_date,
                category,
                activity_type,
                guess_index,
                payload,
                metadata,
                created_at
            ) VALUES (
                score_rec.user_id,
                score_rec.game_date,
                'daily_game',
                'guess_submitted',
                guess_idx,
                jsonb_build_object(
                    'guess_result', guess_elem,
                    'all_guesses', cum_guesses,
                    'guess_number', guess_idx + 1,
                    'total_attempts', total_guesses,
                    'status', score_rec.status
                ),
                jsonb_build_object(
                    'word_length', 5,
                    'source', 'backfill'
                ),
                g_timestamp
            )
            ON CONFLICT (user_id, game_date, activity_type, guess_index) DO NOTHING;
        END LOOP;

        -- B. If hint was used, record a 'hint_used' activity
        IF score_rec.hints_used = TRUE THEN
            INSERT INTO public.social_activities (
                user_id,
                game_date,
                category,
                activity_type,
                guess_index,
                payload,
                metadata,
                created_at
            ) VALUES (
                score_rec.user_id,
                score_rec.game_date,
                'daily_game',
                'hint_used',
                NULL,
                jsonb_build_object(
                    'hint_record', score_rec.hint_record
                ),
                jsonb_build_object(
                    'word_length', 5,
                    'source', 'backfill'
                ),
                base_time - interval '10 seconds'
            )
            ON CONFLICT (user_id, game_date, activity_type, guess_index) DO NOTHING;
        END IF;

        -- C. If game ended in win/loss, record completion activity
        IF score_rec.status IN ('won', 'lost') THEN
            INSERT INTO public.social_activities (
                user_id,
                game_date,
                category,
                activity_type,
                guess_index,
                payload,
                metadata,
                created_at
            ) VALUES (
                score_rec.user_id,
                score_rec.game_date,
                'daily_game',
                CASE WHEN score_rec.status = 'won' THEN 'game_won' ELSE 'game_lost' END,
                NULL,
                jsonb_build_object(
                    'attempts', total_guesses,
                    'all_guesses', score_rec.guesses,
                    'total_score', COALESCE(score_rec.skill_score, 0),
                    'hints_used', score_rec.hints_used
                ),
                jsonb_build_object(
                    'word_length', 5,
                    'source', 'backfill'
                ),
                base_time
            )
            ON CONFLICT (user_id, game_date, activity_type, guess_index) DO NOTHING;
        END IF;

    END LOOP;
END $$;
