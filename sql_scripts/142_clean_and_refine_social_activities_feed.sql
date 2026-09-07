-- 142_clean_and_refine_social_activities_feed.sql
-- 1. Ensure RLS allows DELETE for owners & clean previous activities
ALTER TABLE public.social_activities ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_activities' AND policyname = 'Users can delete their own activities') THEN
        CREATE POLICY "Users can delete their own activities" 
            ON public.social_activities FOR DELETE 
            USING (auth.uid() = user_id);
    END IF;
END $$;

TRUNCATE TABLE public.social_activities;

-- 2. Backfill:
-- A. Completed Game Runs: game_started, hint_used (with letter & position), game_won / game_lost (with all progressive guesses + score)
-- Guard: ONLY users with completed games (status = 'won' OR status = 'lost')
DO $$
DECLARE
    score_rec RECORD;
    total_guesses INTEGER;
    first_guess JSONB;
    final_guess JSONB;
    hint_letter TEXT;
    hint_pos INTEGER;
    g_timestamp TIMESTAMPTZ;
    base_time TIMESTAMPTZ;
    ts_array JSONB;
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
        WHERE s.game_date::text IN ('2026-09-06', '2026-09-07')
          AND s.user_id IS NOT NULL
          AND s.guesses IS NOT NULL
          AND jsonb_typeof(s.guesses) = 'array'
          AND jsonb_array_length(s.guesses) > 0
          -- Guard against incomplete plays
          AND s.status IN ('won', 'lost')
    LOOP
        total_guesses := jsonb_array_length(score_rec.guesses);
        first_guess := score_rec.guesses->0;
        final_guess := score_rec.guesses->(total_guesses - 1);
        ts_array := score_rec.guess_timestamps;
        base_time := COALESCE(score_rec.created_at, timezone('utc'::text, now()));

        -- Determine initial start time (Guess 1)
        IF ts_array IS NOT NULL AND jsonb_typeof(ts_array) = 'array' AND jsonb_array_length(ts_array) > 0 THEN
            BEGIN
                IF jsonb_typeof(ts_array->0) = 'number' THEN
                    g_timestamp := to_timestamp((ts_array->>0)::double precision / 1000.0);
                ELSE
                    g_timestamp := (ts_array->>0)::timestamptz;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                g_timestamp := base_time - (interval '2 minutes');
            END;
        ELSE
            g_timestamp := base_time - (interval '2 minutes');
        END IF;

        -- 1. Record 'game_started' Activity
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
            'game_started',
            0,
            jsonb_build_object(
                'guess_result', first_guess,
                'all_guesses', jsonb_build_array(first_guess),
                'guess_number', 1,
                'total_attempts', total_guesses,
                'status', 'playing'
            ),
            jsonb_build_object(
                'word_length', 5,
                'source', 'backfill'
            ),
            g_timestamp
        )
        ON CONFLICT (user_id, game_date, activity_type, guess_index) DO NOTHING;

        -- 2. Record 'hint_used' Activity
        IF score_rec.hints_used = TRUE AND score_rec.hint_record IS NOT NULL THEN
            hint_letter := score_rec.hint_record->>'letter';
            hint_pos := COALESCE((score_rec.hint_record->>'index')::integer + 1, 1);

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
                    'hint_record', score_rec.hint_record,
                    'letter', hint_letter,
                    'position', hint_pos
                ),
                jsonb_build_object(
                    'word_length', 5,
                    'source', 'backfill'
                ),
                base_time - interval '30 seconds'
            )
            ON CONFLICT (user_id, game_date, activity_type, guess_index) DO NOTHING;
        END IF;

        -- 3. Record 'game_won' / 'game_lost' Completion Activity
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
            total_guesses - 1,
            jsonb_build_object(
                'guess_result', final_guess,
                'all_guesses', score_rec.guesses,
                'attempts', total_guesses,
                'total_score', COALESCE(score_rec.skill_score, 0),
                'hints_used', score_rec.hints_used,
                'status', score_rec.status
            ),
            jsonb_build_object(
                'word_length', 5,
                'source', 'backfill'
            ),
            base_time
        )
        ON CONFLICT (user_id, game_date, activity_type, guess_index) DO NOTHING;

    END LOOP;
END $$;

-- B. Backfill existing guess comments as dedicated Newsfeed Activity items
-- Attaches the full puzzle guesses of the target user with the target guess row highlighted
DO $$
DECLARE
    cm_rec RECORD;
    target_score RECORD;
    highlighted_guess JSONB;
BEGIN
    FOR cm_rec IN 
        SELECT 
            gc.id,
            gc.author_id,
            gc.target_user_id,
            gc.game_date,
            gc.guess_index,
            gc.content,
            gc.created_at,
            p.username AS author_username,
            tp.username AS target_username
        FROM public.guess_comments gc
        JOIN public.profiles p ON p.id = gc.author_id
        LEFT JOIN public.profiles tp ON tp.id = gc.target_user_id
        WHERE gc.game_date IN ('2026-09-06', '2026-09-07')
          AND COALESCE(gc.is_deleted, FALSE) = FALSE
    LOOP
        -- Fetch target player's full guesses context
        SELECT s.guesses, s.status, s.skill_score INTO target_score
        FROM public.scores s
        WHERE s.user_id = cm_rec.target_user_id 
          AND s.game_date::text = cm_rec.game_date::text
        LIMIT 1;

        IF target_score.guesses IS NOT NULL AND jsonb_array_length(target_score.guesses) > cm_rec.guess_index THEN
            highlighted_guess := target_score.guesses->cm_rec.guess_index;
        ELSE
            highlighted_guess := '[]'::jsonb;
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
            cm_rec.author_id,
            cm_rec.game_date::text,
            'social',
            'guess_comment_posted',
            cm_rec.guess_index,
            jsonb_build_object(
                'comment_id', cm_rec.id,
                'content', cm_rec.content,
                'target_user_id', cm_rec.target_user_id,
                'target_username', COALESCE(cm_rec.target_username, 'Player'),
                'highlighted_row_index', cm_rec.guess_index,
                'highlighted_guess', highlighted_guess,
                'all_guesses', COALESCE(target_score.guesses, '[]'::jsonb)
            ),
            jsonb_build_object(
                'source', 'backfill'
            ),
            cm_rec.created_at
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- C. Backfill existing guess reactions as dedicated Newsfeed Activity items
DO $$
DECLARE
    rx_rec RECORD;
    target_score RECORD;
    highlighted_guess JSONB;
BEGIN
    FOR rx_rec IN 
        SELECT 
            gr.user_id,
            gr.target_user_id,
            gr.game_date,
            gr.guess_index,
            gr.reaction,
            gr.created_at,
            p.username AS author_username,
            tp.username AS target_username
        FROM public.guess_reactions gr
        JOIN public.profiles p ON p.id = gr.user_id
        LEFT JOIN public.profiles tp ON tp.id = gr.target_user_id
        WHERE gr.game_date::text IN ('2026-09-06', '2026-09-07')
    LOOP
        -- Fetch target player's full guesses context
        SELECT s.guesses INTO target_score
        FROM public.scores s
        WHERE s.user_id = rx_rec.target_user_id 
          AND s.game_date::text = rx_rec.game_date::text
        LIMIT 1;

        IF target_score.guesses IS NOT NULL AND jsonb_array_length(target_score.guesses) > rx_rec.guess_index THEN
            highlighted_guess := target_score.guesses->rx_rec.guess_index;
        ELSE
            highlighted_guess := '[]'::jsonb;
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
            rx_rec.user_id,
            rx_rec.game_date::text,
            'social',
            'guess_reaction_posted',
            rx_rec.guess_index,
            jsonb_build_object(
                'reaction', rx_rec.reaction,
                'target_user_id', rx_rec.target_user_id,
                'target_username', COALESCE(rx_rec.target_username, 'Player'),
                'highlighted_row_index', rx_rec.guess_index,
                'highlighted_guess', highlighted_guess,
                'all_guesses', COALESCE(target_score.guesses, '[]'::jsonb)
            ),
            jsonb_build_object(
                'source', 'backfill'
            ),
            rx_rec.created_at
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
