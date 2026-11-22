-- 150_wordup_topic_response_telemetry.sql
-- Collects and aggregates real human response time & accuracy telemetry per WordUp topic
-- so synthetic bot profiles mimic authentic human speed distributions per category.

-- 1. Create per-topic response telemetry table
CREATE TABLE IF NOT EXISTS public.wordup_topic_telemetry (
    category VARCHAR(50) PRIMARY KEY,
    sample_count INTEGER NOT NULL DEFAULT 0,
    avg_time_taken NUMERIC(5,2) NOT NULL DEFAULT 2.20,
    p25_time_taken NUMERIC(5,2) NOT NULL DEFAULT 1.35,
    median_time_taken NUMERIC(5,2) NOT NULL DEFAULT 2.05,
    p75_time_taken NUMERIC(5,2) NOT NULL DEFAULT 2.95,
    avg_accuracy NUMERIC(4,3) NOT NULL DEFAULT 0.760,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wordup_topic_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Topic telemetry viewable by everyone" ON public.wordup_topic_telemetry;
CREATE POLICY "Topic telemetry viewable by everyone"
ON public.wordup_topic_telemetry FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Seed calibrated initial human baselines per topic
INSERT INTO public.wordup_topic_telemetry (
    category, sample_count, avg_time_taken, p25_time_taken, median_time_taken, p75_time_taken, avg_accuracy
)
VALUES
    ('flag_bearer',       25, 1.85, 1.15, 1.70, 2.45, 0.810),
    ('mixed',             25, 2.05, 1.25, 1.90, 2.75, 0.780),
    ('football',          25, 2.10, 1.30, 1.95, 2.80, 0.770),
    ('sports',            25, 2.10, 1.30, 1.95, 2.80, 0.760),
    ('television',        25, 2.05, 1.25, 1.90, 2.75, 0.780),
    ('video_games',       25, 2.05, 1.25, 1.90, 2.75, 0.780),
    ('general_knowledge', 25, 2.20, 1.35, 2.05, 2.95, 0.760),
    ('geography',         25, 2.15, 1.30, 2.00, 2.85, 0.770),
    ('english_language',  25, 2.25, 1.40, 2.10, 3.00, 0.760),
    ('bible',             25, 2.30, 1.45, 2.15, 3.10, 0.770),
    ('history',           25, 2.35, 1.45, 2.20, 3.15, 0.750),
    ('global-politics',   25, 2.40, 1.50, 2.25, 3.20, 0.740),
    ('computers',         25, 2.25, 1.40, 2.10, 3.00, 0.760),
    ('chemistry',         25, 2.50, 1.55, 2.35, 3.40, 0.730),
    ('physics',           25, 2.70, 1.70, 2.55, 3.70, 0.720),
    ('maths',             25, 2.85, 1.75, 2.65, 3.90, 0.740),
    ('reverse_wordle',    25, 3.10, 1.95, 2.90, 4.20, 0.710)
ON CONFLICT (category) DO NOTHING;

-- 3. Backfill from existing real human answers in wordup_matches and wordup_async_matches
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        WITH human_answers AS (
            -- Player 1 answers from live/bot matches (Player 1 is always human)
            SELECT
                m.category,
                (ans->>'time_taken')::NUMERIC AS time_taken,
                COALESCE((ans->>'correct')::BOOLEAN, FALSE) AS correct
            FROM public.wordup_matches m
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.p1_answers, '[]'::jsonb)) AS ans
            WHERE m.status = 'completed'
              AND (ans->>'time_taken') IS NOT NULL
              AND (ans->>'time_taken')::NUMERIC BETWEEN 0.35 AND 9.80

            UNION ALL

            -- Player 2 answers from real PvP live matches (exclude bot matches)
            SELECT
                m.category,
                (ans->>'time_taken')::NUMERIC AS time_taken,
                COALESCE((ans->>'correct')::BOOLEAN, FALSE) AS correct
            FROM public.wordup_matches m
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.p2_answers, '[]'::jsonb)) AS ans
            WHERE m.status = 'completed'
              AND COALESCE(m.is_bot_match, FALSE) = FALSE
              AND (ans->>'time_taken') IS NOT NULL
              AND (ans->>'time_taken')::NUMERIC BETWEEN 0.35 AND 9.80

            UNION ALL

            -- Player 1 & Player 2 answers from async 1v1 matches
            SELECT
                am.category,
                (ans->>'time_taken')::NUMERIC AS time_taken,
                COALESCE((ans->>'correct')::BOOLEAN, FALSE) AS correct
            FROM public.wordup_async_matches am
            CROSS JOIN LATERAL jsonb_array_elements(
                COALESCE(am.p1_answers, '[]'::jsonb) || COALESCE(am.p2_answers, '[]'::jsonb)
            ) AS ans
            WHERE am.status = 'completed'
              AND (ans->>'time_taken') IS NOT NULL
              AND (ans->>'time_taken')::NUMERIC BETWEEN 0.35 AND 9.80
        )
        SELECT
            category,
            COUNT(*)::INT AS cnt,
            ROUND(AVG(time_taken)::NUMERIC, 2) AS avg_t,
            ROUND((PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY time_taken))::NUMERIC, 2) AS p25_t,
            ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY time_taken))::NUMERIC, 2) AS med_t,
            ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY time_taken))::NUMERIC, 2) AS p75_t,
            ROUND(AVG(CASE WHEN correct THEN 1.0 ELSE 0.0 END)::NUMERIC, 3) AS avg_acc
        FROM human_answers
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        HAVING COUNT(*) >= 5
    ) LOOP
        INSERT INTO public.wordup_topic_telemetry (
            category, sample_count, avg_time_taken, p25_time_taken, median_time_taken, p75_time_taken, avg_accuracy, updated_at
        )
        VALUES (
            r.category,
            r.cnt,
            GREATEST(0.80, LEAST(6.50, r.avg_t)),
            GREATEST(0.65, LEAST(4.50, r.p25_t)),
            GREATEST(0.80, LEAST(5.50, r.med_t)),
            GREATEST(1.10, LEAST(7.50, r.p75_t)),
            GREATEST(0.400, LEAST(0.960, r.avg_acc)),
            NOW()
        )
        ON CONFLICT (category) DO UPDATE SET
            sample_count = EXCLUDED.sample_count,
            avg_time_taken = EXCLUDED.avg_time_taken,
            p25_time_taken = EXCLUDED.p25_time_taken,
            median_time_taken = EXCLUDED.median_time_taken,
            p75_time_taken = EXCLUDED.p75_time_taken,
            avg_accuracy = EXCLUDED.avg_accuracy,
            updated_at = NOW();
    END LOOP;
END $$;

-- 4. RPC: Record new human round telemetry after a match and update rolling topic percentiles
CREATE OR REPLACE FUNCTION public.record_wordup_topic_telemetry(
    p_category VARCHAR,
    p_times_taken NUMERIC[],
    p_corrects BOOLEAN[]
)
RETURNS JSONB AS $$
DECLARE
    v_n INT;
    v_valid_times NUMERIC[] := ARRAY[]::NUMERIC[];
    v_correct_count INT := 0;
    v_total_count INT := 0;
    i INT;
    v_t NUMERIC;
    v_c BOOLEAN;
    v_batch_avg NUMERIC;
    v_batch_p25 NUMERIC;
    v_batch_med NUMERIC;
    v_batch_p75 NUMERIC;
    v_batch_acc NUMERIC;
    v_cur RECORD;
    v_alpha NUMERIC;
    v_new_count INT;
    v_new_avg NUMERIC(5,2);
    v_new_p25 NUMERIC(5,2);
    v_new_med NUMERIC(5,2);
    v_new_p75 NUMERIC(5,2);
    v_new_acc NUMERIC(4,3);
BEGIN
    IF p_category IS NULL OR p_category = '' OR p_times_taken IS NULL THEN
        RETURN jsonb_build_object('updated', false);
    END IF;

    v_n := COALESCE(array_length(p_times_taken, 1), 0);
    IF v_n = 0 THEN
        RETURN jsonb_build_object('updated', false);
    END IF;

    FOR i IN 1..v_n LOOP
        v_t := p_times_taken[i];
        v_c := COALESCE(p_corrects[i], FALSE);
        IF v_t IS NOT NULL AND v_t >= 0.35 AND v_t <= 9.80 THEN
            v_valid_times := array_append(v_valid_times, v_t);
            v_total_count := v_total_count + 1;
            IF v_c THEN
                v_correct_count := v_correct_count + 1;
            END IF;
        END IF;
    END LOOP;

    IF v_total_count = 0 THEN
        RETURN jsonb_build_object('updated', false);
    END IF;

    -- Compute batch percentiles across the valid human answers in this match
    SELECT
        AVG(x),
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY x),
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY x),
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY x)
    INTO v_batch_avg, v_batch_p25, v_batch_med, v_batch_p75
    FROM unnest(v_valid_times) AS x;

    v_batch_acc := v_correct_count::NUMERIC / v_total_count::NUMERIC;

    SELECT * INTO v_cur
    FROM public.wordup_topic_telemetry
    WHERE category = p_category;

    IF v_cur.category IS NULL THEN
        v_new_count := v_total_count;
        v_new_avg := ROUND(GREATEST(0.80, LEAST(6.50, v_batch_avg))::NUMERIC, 2);
        v_new_p25 := ROUND(GREATEST(0.65, LEAST(4.50, v_batch_p25))::NUMERIC, 2);
        v_new_med := ROUND(GREATEST(0.80, LEAST(5.50, v_batch_med))::NUMERIC, 2);
        v_new_p75 := ROUND(GREATEST(1.10, LEAST(7.50, v_batch_p75))::NUMERIC, 2);
        v_new_acc := ROUND(GREATEST(0.400, LEAST(0.960, v_batch_acc))::NUMERIC, 3);

        INSERT INTO public.wordup_topic_telemetry (
            category, sample_count, avg_time_taken, p25_time_taken, median_time_taken, p75_time_taken, avg_accuracy, updated_at
        )
        VALUES (
            p_category, v_new_count, v_new_avg, v_new_p25, v_new_med, v_new_p75, v_new_acc, NOW()
        );
    ELSE
        v_new_count := v_cur.sample_count + v_total_count;
        -- Rolling weight (caps influence of a single match to >= 5% and <= 25%)
        v_alpha := GREATEST(0.05, LEAST(0.25, v_total_count::NUMERIC / GREATEST(20, v_new_count)::NUMERIC));

        v_new_avg := ROUND(GREATEST(0.80, LEAST(6.50, v_cur.avg_time_taken * (1 - v_alpha) + v_batch_avg * v_alpha))::NUMERIC, 2);
        v_new_p25 := ROUND(GREATEST(0.65, LEAST(4.50, v_cur.p25_time_taken * (1 - v_alpha) + v_batch_p25 * v_alpha))::NUMERIC, 2);
        v_new_med := ROUND(GREATEST(0.80, LEAST(5.50, v_cur.median_time_taken * (1 - v_alpha) + v_batch_med * v_alpha))::NUMERIC, 2);
        v_new_p75 := ROUND(GREATEST(1.10, LEAST(7.50, v_cur.p75_time_taken * (1 - v_alpha) + v_batch_p75 * v_alpha))::NUMERIC, 2);
        v_new_acc := ROUND(GREATEST(0.400, LEAST(0.960, v_cur.avg_accuracy * (1 - v_alpha) + v_batch_acc * v_alpha))::NUMERIC, 3);

        UPDATE public.wordup_topic_telemetry
        SET
            sample_count = v_new_count,
            avg_time_taken = v_new_avg,
            p25_time_taken = v_new_p25,
            median_time_taken = v_new_med,
            p75_time_taken = v_new_p75,
            avg_accuracy = v_new_acc,
            updated_at = NOW()
        WHERE category = p_category;
    END IF;

    RETURN jsonb_build_object(
        'updated', true,
        'category', p_category,
        'sample_count', v_new_count,
        'avg_time_taken', v_new_avg,
        'p25_time_taken', v_new_p25,
        'median_time_taken', v_new_med,
        'p75_time_taken', v_new_p75,
        'avg_accuracy', v_new_acc
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_wordup_topic_telemetry(VARCHAR, NUMERIC[], BOOLEAN[]) TO anon, authenticated;

