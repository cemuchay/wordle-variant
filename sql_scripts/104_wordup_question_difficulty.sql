-- 104_wordup_question_difficulty.sql
-- QuizUp-style difficulty ranking for handcrafted questions.
-- Tracks per-question difficulty (global + per-topic) via Elo,
-- and per-user skill ratings for personalized question selection.

-- 1. Per-question difficulty statistics
CREATE TABLE IF NOT EXISTS public.wordup_question_stats (
    question_id UUID PRIMARY KEY REFERENCES public.wordup_handcrafted_questions(id) ON DELETE CASCADE,
    times_shown INT DEFAULT 0 NOT NULL,
    times_correct INT DEFAULT 0 NOT NULL,
    difficulty_elo DECIMAL DEFAULT 1500 NOT NULL,
    topic_elo DECIMAL DEFAULT 1500 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Per-user per-question answer history
CREATE TABLE IF NOT EXISTS public.wordup_user_question_answers (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.wordup_handcrafted_questions(id) ON DELETE CASCADE,
    first_seen BOOLEAN DEFAULT TRUE,
    answered_correctly BOOLEAN NOT NULL,
    time_taken DECIMAL,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, question_id)
);

-- 3. Per-user skill ratings (global + per-topic)
CREATE TABLE IF NOT EXISTS public.wordup_user_skill (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_slug VARCHAR(50) NOT NULL,
    skill_elo DECIMAL DEFAULT 1500 NOT NULL,
    games_played INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, topic_slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wordup_question_stats_diff ON public.wordup_question_stats(difficulty_elo);
CREATE INDEX IF NOT EXISTS idx_wordup_user_qa_user ON public.wordup_user_question_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_wordup_user_skill_user ON public.wordup_user_skill(user_id);

-- RLS (service_role only)
ALTER TABLE public.wordup_question_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordup_user_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordup_user_skill ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role all" ON public.wordup_question_stats USING (true) WITH CHECK (true);
CREATE POLICY "service_role all" ON public.wordup_user_question_answers USING (true) WITH CHECK (true);
CREATE POLICY "service_role all" ON public.wordup_user_skill USING (true) WITH CHECK (true);

-- 4. Record a question answer and update Elo ratings for both question and user
CREATE OR REPLACE FUNCTION public.record_question_answer(
    p_user_id UUID,
    p_question_id UUID,
    p_topic_slug TEXT,
    p_correct BOOLEAN,
    p_time_taken DECIMAL
)
RETURNS VOID AS $$
DECLARE
    v_diff DECIMAL;
    v_topic_diff DECIMAL;
    v_skill DECIMAL;
    v_topic_skill DECIMAL;
    v_times_shown INT;
    v_is_first BOOLEAN;
    v_actual DECIMAL;
    v_k_q DECIMAL := 16;
    v_k_u DECIMAL := 32;
BEGIN
    v_actual := CASE WHEN p_correct THEN 1 ELSE 0 END;

    -- Upsert question stats
    INSERT INTO public.wordup_question_stats (question_id, times_shown, times_correct, difficulty_elo, topic_elo)
    VALUES (p_question_id, 1, CASE WHEN p_correct THEN 1 ELSE 0 END, 1500, 1500)
    ON CONFLICT (question_id) DO UPDATE SET
        times_shown = wordup_question_stats.times_shown + 1,
        times_correct = wordup_question_stats.times_correct + CASE WHEN p_correct THEN 1 ELSE 0 END,
        updated_at = NOW()
    RETURNING difficulty_elo, topic_elo, times_shown
    INTO v_diff, v_topic_diff, v_times_shown;

    -- Was this the first time?
    SELECT NOT EXISTS (
        SELECT 1 FROM public.wordup_user_question_answers
        WHERE user_id = p_user_id AND question_id = p_question_id
    ) INTO v_is_first;

    -- Record user answer
    INSERT INTO public.wordup_user_question_answers (user_id, question_id, first_seen, answered_correctly, time_taken)
    VALUES (p_user_id, p_question_id, v_is_first, p_correct, p_time_taken)
    ON CONFLICT (user_id, question_id) DO UPDATE SET
        answered_correctly = p_correct,
        time_taken = p_time_taken,
        answered_at = NOW();

    -- Get or create global skill
    INSERT INTO public.wordup_user_skill (user_id, topic_slug, skill_elo)
    VALUES (p_user_id, 'global', 1500)
    ON CONFLICT (user_id, topic_slug) DO NOTHING;

    SELECT skill_elo INTO v_skill
    FROM public.wordup_user_skill
    WHERE user_id = p_user_id AND topic_slug = 'global';

    -- Get or create topic skill
    INSERT INTO public.wordup_user_skill (user_id, topic_slug, skill_elo)
    VALUES (p_user_id, p_topic_slug, 1500)
    ON CONFLICT (user_id, topic_slug) DO NOTHING;

    SELECT skill_elo INTO v_topic_skill
    FROM public.wordup_user_skill
    WHERE user_id = p_user_id AND topic_slug = p_topic_slug;

    -- Update global difficulty Elo (question side)
    v_diff := v_diff + v_k_q * ((1.0 / (1.0 + 10.0 ^ ((COALESCE(v_skill, 1500) - v_diff) / 400.0))) - v_actual);

    -- Update topic difficulty Elo
    v_topic_diff := v_topic_diff + v_k_q * ((1.0 / (1.0 + 10.0 ^ ((COALESCE(v_topic_skill, 1500) - v_topic_diff) / 400.0))) - v_actual);

    UPDATE public.wordup_question_stats SET
        difficulty_elo = GREATEST(100, LEAST(2500, v_diff)),
        topic_elo = GREATEST(100, LEAST(2500, v_topic_diff)),
        updated_at = NOW()
    WHERE question_id = p_question_id;

    -- Update global user skill
    v_skill := COALESCE(v_skill, 1500) + v_k_u * (v_actual - (1.0 / (1.0 + 10.0 ^ ((v_diff - COALESCE(v_skill, 1500)) / 400.0))));

    UPDATE public.wordup_user_skill SET
        skill_elo = GREATEST(100, LEAST(2500, v_skill)),
        games_played = games_played + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id AND topic_slug = 'global';

    -- Update topic user skill
    v_topic_skill := COALESCE(v_topic_skill, 1500) + v_k_u * (v_actual - (1.0 / (1.0 + 10.0 ^ ((v_topic_diff - COALESCE(v_topic_skill, 1500)) / 400.0))));

    UPDATE public.wordup_user_skill SET
        skill_elo = GREATEST(100, LEAST(2500, v_topic_skill)),
        updated_at = NOW()
    WHERE user_id = p_user_id AND topic_slug = p_topic_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Get user skill for a topic (returns 1500 default)
CREATE OR REPLACE FUNCTION public.get_user_skill(
    p_user_id UUID,
    p_topic_slug TEXT
)
RETURNS DECIMAL AS $$
DECLARE
    v_skill DECIMAL;
BEGIN
    SELECT skill_elo INTO v_skill
    FROM public.wordup_user_skill
    WHERE user_id = p_user_id AND topic_slug = p_topic_slug;

    RETURN COALESCE(v_skill, 1500);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Batch record post-match answers for a single user
CREATE OR REPLACE FUNCTION public.record_match_answers(
    p_user_id UUID,
    p_topic_slug TEXT,
    p_question_ids UUID[],
    p_corrects BOOLEAN[],
    p_times_taken DECIMAL[]
)
RETURNS VOID AS $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..array_length(p_question_ids, 1) LOOP
        PERFORM public.record_question_answer(
            p_user_id,
            p_question_ids[i],
            p_topic_slug,
            p_corrects[i],
            p_times_taken[i]
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
