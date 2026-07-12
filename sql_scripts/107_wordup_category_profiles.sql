-- 107_wordup_category_profiles.sql
-- Create table for tracking category/topic-specific ratings and stats

CREATE TABLE IF NOT EXISTS public.wordup_category_profiles (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    rating INTEGER DEFAULT 600 NOT NULL,
    xp INTEGER DEFAULT 0 NOT NULL,
    games_played INTEGER DEFAULT 0 NOT NULL,
    games_won INTEGER DEFAULT 0 NOT NULL,
    games_lost INTEGER DEFAULT 0 NOT NULL,
    games_tied INTEGER DEFAULT 0 NOT NULL,
    rank_name VARCHAR(50) DEFAULT 'Bronze' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, category)
);

-- Index for fast ranking query
CREATE INDEX IF NOT EXISTS idx_wordup_cat_profiles_rating ON public.wordup_category_profiles (category, rating DESC);

-- Enable RLS
ALTER TABLE public.wordup_category_profiles ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Category profiles viewable by everyone" ON public.wordup_category_profiles;
CREATE POLICY "Category profiles viewable by everyone"
ON public.wordup_category_profiles FOR SELECT
TO authenticated, anon
USING (true);

-- Update policy
DROP POLICY IF EXISTS "Users can update their own category profile" ON public.wordup_category_profiles;
CREATE POLICY "Users can update their own category profile"
ON public.wordup_category_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Insert policy
DROP POLICY IF EXISTS "Users can insert their own category profile" ON public.wordup_category_profiles;
CREATE POLICY "Users can insert their own category profile"
ON public.wordup_category_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Realtime replication
DO $$
BEGIN
   IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'wordup_category_profiles'
   ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wordup_category_profiles;
   END IF;
END $$;

-- -------------------------------------------------------------
-- Replay Migration Function
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_and_replay_wordup_scores()
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_p1_exists BOOLEAN;
    v_p2_exists BOOLEAN;
    v_p1_global_rating INT;
    v_p1_global_xp INT;
    v_p1_global_played INT;
    v_p1_global_won INT;
    v_p1_global_lost INT;
    v_p1_global_tied INT;
    
    v_p2_global_rating INT;
    v_p2_global_xp INT;
    v_p2_global_played INT;
    v_p2_global_won INT;
    v_p2_global_lost INT;
    v_p2_global_tied INT;

    v_p1_cat_rating INT;
    v_p1_cat_xp INT;
    v_p1_cat_played INT;
    v_p1_cat_won INT;
    v_p1_cat_lost INT;
    v_p1_cat_tied INT;
    
    v_p2_cat_rating INT;
    v_p2_cat_xp INT;
    v_p2_cat_played INT;
    v_p2_cat_won INT;
    v_p2_cat_lost INT;
    v_p2_cat_tied INT;

    v_p1_correct INT;
    v_p2_correct INT;
    
    v_p1_won BOOLEAN;
    v_p2_won BOOLEAN;
    v_tied BOOLEAN;
    
    v_p1_xp_gain INT;
    v_p2_xp_gain INT;
    
    v_p2_rating_for_p1 INT;
    v_p1_rating_for_p2 INT;
    
    v_expected_p1 NUMERIC;
    v_expected_p2 NUMERIC;
    v_actual_p1 NUMERIC;
    v_actual_p2 NUMERIC;
    
    v_p1_elo_gain INT;
    v_p2_elo_gain INT;
    
    v_rank_name VARCHAR(50);
BEGIN
    -- 1. Truncate topic profiles
    TRUNCATE TABLE public.wordup_category_profiles;

    -- 2. Reset global profiles
    UPDATE public.wordup_profiles SET
        rating = 600,
        xp = 0,
        games_played = 0,
        games_won = 0,
        games_lost = 0,
        games_tied = 0,
        rank_name = 'Bronze',
        updated_at = NOW();

    -- 3. Loop through all completed matches chronologically
    FOR r IN (
        SELECT id, category, player1_id, player2_id, p1_score, p2_score, p1_answers, p2_answers, COALESCE(completed_at, created_at) AS played_at, is_bot_match, bot_profile
        FROM public.wordup_matches
        WHERE status = 'completed'
        UNION ALL
        SELECT id, category, player1_id, player2_id, p1_score, p2_score, p1_answers, p2_answers, COALESCE(completed_at, created_at) AS played_at, FALSE AS is_bot_match, NULL::VARCHAR AS bot_profile
        FROM public.wordup_async_matches
        WHERE status = 'completed'
        ORDER BY played_at ASC
    ) LOOP
        -- Skip if player1 is null
        IF r.player1_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Verify if players exist in wordup_profiles (or guest_profiles)
        SELECT EXISTS(SELECT 1 FROM public.wordup_profiles WHERE id = r.player1_id) INTO v_p1_exists;
        IF NOT v_p1_exists THEN
            -- Ensure guest users or backfilled profiles have a profile record
            INSERT INTO public.wordup_profiles (id) VALUES (r.player1_id) ON CONFLICT (id) DO NOTHING;
        END IF;

        IF r.player2_id IS NOT NULL AND NOT r.is_bot_match THEN
            SELECT EXISTS(SELECT 1 FROM public.wordup_profiles WHERE id = r.player2_id) INTO v_p2_exists;
            IF NOT v_p2_exists THEN
                INSERT INTO public.wordup_profiles (id) VALUES (r.player2_id) ON CONFLICT (id) DO NOTHING;
            END IF;
        ELSE
            v_p2_exists := FALSE;
        END IF;

        -- Outcome calculation
        v_p1_won := r.p1_score > r.p2_score;
        v_p2_won := r.p2_score > r.p1_score;
        v_tied := r.p1_score = r.p2_score;

        -- Correct count from answers JSONB
        v_p1_correct := COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(r.p1_answers) x WHERE (x->>'correct')::boolean = TRUE), 0);
        v_p2_correct := COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(r.p2_answers) x WHERE (x->>'correct')::boolean = TRUE), 0);

        -- XP Gain calculations
        v_p1_xp_gain := 50 + (CASE WHEN v_p1_won THEN 100 ELSE 0 END) + (v_p1_correct * 10);
        v_p2_xp_gain := 50 + (CASE WHEN v_p2_won THEN 100 ELSE 0 END) + (v_p2_correct * 10);

        -- Load P1 ratings
        SELECT rating, xp, games_played, games_won, games_lost, games_tied INTO v_p1_global_rating, v_p1_global_xp, v_p1_global_played, v_p1_global_won, v_p1_global_lost, v_p1_global_tied FROM public.wordup_profiles WHERE id = r.player1_id;
        
        -- Load or initialize P1 category rating
        SELECT rating, xp, games_played, games_won, games_lost, games_tied INTO v_p1_cat_rating, v_p1_cat_xp, v_p1_cat_played, v_p1_cat_won, v_p1_cat_lost, v_p1_cat_tied FROM public.wordup_category_profiles WHERE user_id = r.player1_id AND category = r.category;
        IF v_p1_cat_rating IS NULL THEN
            v_p1_cat_rating := 600;
            v_p1_cat_xp := 0;
            v_p1_cat_played := 0;
            v_p1_cat_won := 0;
            v_p1_cat_lost := 0;
            v_p1_cat_tied := 0;
        END IF;

        -- Load P2 ratings (if real player)
        IF v_p2_exists THEN
            SELECT rating, xp, games_played, games_won, games_lost, games_tied INTO v_p2_global_rating, v_p2_global_xp, v_p2_global_played, v_p2_global_won, v_p2_global_lost, v_p2_global_tied FROM public.wordup_profiles WHERE id = r.player2_id;
            SELECT rating, xp, games_played, games_won, games_lost, games_tied INTO v_p2_cat_rating, v_p2_cat_xp, v_p2_cat_played, v_p2_cat_won, v_p2_cat_lost, v_p2_cat_tied FROM public.wordup_category_profiles WHERE user_id = r.player2_id AND category = r.category;
            IF v_p2_cat_rating IS NULL THEN
                v_p2_cat_rating := 600;
                v_p2_cat_xp := 0;
                v_p2_cat_played := 0;
                v_p2_cat_won := 0;
                v_p2_cat_lost := 0;
                v_p2_cat_tied := 0;
            END IF;

            v_p2_rating_for_p1 := v_p2_global_rating;
            v_p1_rating_for_p2 := v_p1_global_rating;
        ELSE
            -- Bot ELO rating helper
            IF r.is_bot_match THEN
                v_p2_rating_for_p1 := CASE 
                    WHEN r.bot_profile = 'impossible' THEN 2200
                    WHEN r.bot_profile = 'master' THEN 1800
                    WHEN r.bot_profile = 'expert' THEN 1400
                    WHEN r.bot_profile = 'gold' THEN 1400
                    WHEN r.bot_profile = 'slow_thinker' THEN 800
                    ELSE 1000 -- average
                END;
            ELSE
                v_p2_rating_for_p1 := 1000;
            END IF;
            v_p1_rating_for_p2 := 600;
        END IF;

        -- ----------------------------
        -- Player 1 Rating Calculations
        -- ----------------------------
        v_expected_p1 := 1.0 / (1.0 + 10.0 ^ ((v_p2_rating_for_p1 - v_p1_global_rating)::numeric / 400.0));
        v_actual_p1 := CASE WHEN v_p1_won THEN 1.0 WHEN v_tied THEN 0.5 ELSE 0.0 END;
        v_p1_elo_gain := ROUND(32 * (v_actual_p1 - v_expected_p1)) + (CASE WHEN v_p1_won THEN v_p1_correct ELSE 0 END);
        IF v_p1_won AND v_p1_elo_gain < 2 THEN v_p1_elo_gain := 2; END IF;
        IF NOT v_p1_won AND NOT v_tied AND v_p1_elo_gain < -2 THEN v_p1_elo_gain := -2; END IF;

        -- Update P1 global profile
        v_p1_global_rating := GREATEST(600, v_p1_global_rating + v_p1_elo_gain);
        v_rank_name := CASE 
            WHEN v_p1_global_rating >= 1700 THEN 'Master'
            WHEN v_p1_global_rating >= 1400 THEN 'Diamond'
            WHEN v_p1_global_rating >= 1100 THEN 'Gold'
            WHEN v_p1_global_rating >= 800 THEN 'Silver'
            ELSE 'Bronze'
        END;

        UPDATE public.wordup_profiles SET
            rating = v_p1_global_rating,
            xp = xp + v_p1_xp_gain,
            games_played = games_played + 1,
            games_won = games_won + (CASE WHEN v_p1_won THEN 1 ELSE 0 END),
            games_lost = games_lost + (CASE WHEN v_p1_won OR v_tied THEN 0 ELSE 1 END),
            games_tied = games_tied + (CASE WHEN v_tied THEN 1 ELSE 0 END),
            rank_name = v_rank_name,
            updated_at = r.played_at
        WHERE id = r.player1_id;

        -- Update P1 category profile
        v_p1_cat_rating := GREATEST(600, v_p1_cat_rating + v_p1_elo_gain);
        v_rank_name := CASE 
            WHEN v_p1_cat_rating >= 1700 THEN 'Master'
            WHEN v_p1_cat_rating >= 1400 THEN 'Diamond'
            WHEN v_p1_cat_rating >= 1100 THEN 'Gold'
            WHEN v_p1_cat_rating >= 800 THEN 'Silver'
            ELSE 'Bronze'
        END;

        INSERT INTO public.wordup_category_profiles (user_id, category, rating, xp, games_played, games_won, games_lost, games_tied, rank_name, updated_at)
        VALUES (
            r.player1_id, r.category, v_p1_cat_rating, v_p1_cat_xp + v_p1_xp_gain, 
            v_p1_cat_played + 1, v_p1_cat_won + (CASE WHEN v_p1_won THEN 1 ELSE 0 END), 
            v_p1_cat_lost + (CASE WHEN v_p1_won OR v_tied THEN 0 ELSE 1 END), 
            v_p1_cat_tied + (CASE WHEN v_tied THEN 1 ELSE 0 END), 
            v_rank_name, r.played_at
        ) ON CONFLICT (user_id, category) DO UPDATE SET
            rating = EXCLUDED.rating,
            xp = EXCLUDED.xp,
            games_played = EXCLUDED.games_played,
            games_won = EXCLUDED.games_won,
            games_lost = EXCLUDED.games_lost,
            games_tied = EXCLUDED.games_tied,
            rank_name = EXCLUDED.rank_name,
            updated_at = EXCLUDED.updated_at;

        -- ----------------------------
        -- Player 2 Rating Calculations (Real Player Only)
        -- ----------------------------
        IF v_p2_exists THEN
            v_expected_p2 := 1.0 / (1.0 + 10.0 ^ ((v_p1_rating_for_p2 - v_p2_global_rating)::numeric / 400.0));
            v_actual_p2 := CASE WHEN v_p2_won THEN 1.0 WHEN v_tied THEN 0.5 ELSE 0.0 END;
            v_p2_elo_gain := ROUND(32 * (v_actual_p2 - v_expected_p2)) + (CASE WHEN v_p2_won THEN v_p2_correct ELSE 0 END);
            IF v_p2_won AND v_p2_elo_gain < 2 THEN v_p2_elo_gain := 2; END IF;
            IF NOT v_p2_won AND NOT v_tied AND v_p2_elo_gain < -2 THEN v_p2_elo_gain := -2; END IF;

            -- Update P2 global profile
            v_p2_global_rating := GREATEST(600, v_p2_global_rating + v_p2_elo_gain);
            v_rank_name := CASE 
                WHEN v_p2_global_rating >= 1700 THEN 'Master'
                WHEN v_p2_global_rating >= 1400 THEN 'Diamond'
                WHEN v_p2_global_rating >= 1100 THEN 'Gold'
                WHEN v_p2_global_rating >= 800 THEN 'Silver'
                ELSE 'Bronze'
            END;

            UPDATE public.wordup_profiles SET
                rating = v_p2_global_rating,
                xp = xp + v_p2_xp_gain,
                games_played = games_played + 1,
                games_won = games_won + (CASE WHEN v_p2_won THEN 1 ELSE 0 END),
                games_lost = games_lost + (CASE WHEN v_p2_won OR v_tied THEN 0 ELSE 1 END),
                games_tied = games_tied + (CASE WHEN v_tied THEN 1 ELSE 0 END),
                rank_name = v_rank_name,
                updated_at = r.played_at
            WHERE id = r.player2_id;

            -- Update P2 category profile
            v_p2_cat_rating := GREATEST(600, v_p2_cat_rating + v_p2_elo_gain);
            v_rank_name := CASE 
                WHEN v_p2_cat_rating >= 1700 THEN 'Master'
                WHEN v_p2_cat_rating >= 1400 THEN 'Diamond'
                WHEN v_p2_cat_rating >= 1100 THEN 'Gold'
                WHEN v_p2_cat_rating >= 800 THEN 'Silver'
                ELSE 'Bronze'
            END;

            INSERT INTO public.wordup_category_profiles (user_id, category, rating, xp, games_played, games_won, games_lost, games_tied, rank_name, updated_at)
            VALUES (
                r.player2_id, r.category, v_p2_cat_rating, v_p2_cat_xp + v_p2_xp_gain, 
                v_p2_cat_played + 1, v_p2_cat_won + (CASE WHEN v_p2_won THEN 1 ELSE 0 END), 
                v_p2_cat_lost + (CASE WHEN v_p2_won OR v_tied THEN 0 ELSE 1 END), 
                v_p2_cat_tied + (CASE WHEN v_tied THEN 1 ELSE 0 END), 
                v_rank_name, r.played_at
            ) ON CONFLICT (user_id, category) DO UPDATE SET
                rating = EXCLUDED.rating,
                xp = EXCLUDED.xp,
                games_played = EXCLUDED.games_played,
                games_won = EXCLUDED.games_won,
                games_lost = EXCLUDED.games_lost,
                games_tied = EXCLUDED.games_tied,
                rank_name = EXCLUDED.rank_name,
                updated_at = EXCLUDED.updated_at;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
