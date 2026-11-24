-- 152_wordup_otdb_curation_and_cleanup.sql
-- Open Trivia DB curation pipeline support:
--   1. `source` column to separate permanent handcrafted questions from curated OpenTDB questions
--   2. TTL cleanup RPC for curated questions (never touches handcrafted)
--   3. Validated, rate-limited client-side curation RPC (no service-role key needed in browser)
--   4. Self-scoped "seen" recorder for prefetched matches
--   5. Daily safety-net pg_cron cleanup job

-- ─────────────────────────────────────────────────────────────
-- 1. Schema: source column + indexes
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.wordup_handcrafted_questions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'handcrafted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wordup_handcrafted_questions_source_check'
  ) THEN
    ALTER TABLE public.wordup_handcrafted_questions
      ADD CONSTRAINT wordup_handcrafted_questions_source_check
      CHECK (source IN ('handcrafted', 'opentdb'));
  END IF;
END $$;

-- Backfill previously synced OpenTDB rows (both explanation formats used historically)
UPDATE public.wordup_handcrafted_questions
SET source = 'opentdb',
    expires_at = COALESCE(expires_at, created_at + INTERVAL '30 days')
WHERE source = 'handcrafted'
  AND (
    explanation LIKE '%(Curated via Open Trivia DB)%'
    OR explanation LIKE 'The correct answer is indeed "%'
  );

CREATE INDEX IF NOT EXISTS idx_wordup_handcrafted_source_expires
  ON public.wordup_handcrafted_questions (source, expires_at);

CREATE INDEX IF NOT EXISTS idx_wordup_handcrafted_source_category_created
  ON public.wordup_handcrafted_questions (source, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wordup_user_handcrafted_history_user_seen
  ON public.wordup_user_handcrafted_history (user_id, seen_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. Cleanup RPC: delete expired curated questions only
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_curated_questions(
  p_max_age_days INT DEFAULT 30
)
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.wordup_handcrafted_questions
  WHERE source = 'opentdb'
    AND (
      (expires_at IS NOT NULL AND expires_at <= NOW())
      OR created_at < NOW() - make_interval(days => GREATEST(1, COALESCE(p_max_age_days, 30)))
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cleanup_expired_curated_questions(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_curated_questions(INT) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Client-side curation RPC (validated + globally rate-limited)
--    p_questions: [{ prompt, answer, choices: [..], difficulty?: 'easy'|'medium'|'hard' }]
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_curated_otdb_questions(
  p_category TEXT,
  p_questions JSONB,
  p_ttl_days INT DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  v_allowed TEXT[] := ARRAY[
    'computers', 'sports', 'maths', 'geography', 'history', 'general_knowledge',
    'television', 'video_games', 'movies', 'music', 'animals',
    'physics', 'chemistry', 'biology'
  ];
  v_ttl INT := LEAST(GREATEST(COALESCE(p_ttl_days, 30), 1), 90);
  v_item JSONB;
  v_prompt TEXT;
  v_answer TEXT;
  v_choices TEXT[];
  v_diff INT;
  v_inserted INT := 0;
  v_count INT := 0;
BEGIN
  IF p_category IS NULL OR NOT (p_category = ANY (v_allowed)) THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', true, 'reason', 'category_not_allowed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.slug = p_category AND (t.is_active = false OR t.is_suspended = true)
  ) THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', true, 'reason', 'topic_inactive');
  END IF;

  -- Global per-category cooldown (6h) so concurrent visitors never spam inserts
  IF EXISTS (
    SELECT 1 FROM public.wordup_handcrafted_questions
    WHERE source = 'opentdb'
      AND category = p_category
      AND created_at > NOW() - INTERVAL '6 hours'
  ) THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', true, 'reason', 'cooldown');
  END IF;

  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', true, 'reason', 'invalid_payload');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_questions) LOOP
    v_count := v_count + 1;
    EXIT WHEN v_count > 30;

    v_prompt := btrim(COALESCE(v_item->>'prompt', ''));
    v_answer := btrim(COALESCE(v_item->>'answer', ''));
    IF length(v_prompt) < 8 OR length(v_prompt) > 400 OR v_answer = '' OR length(v_answer) > 200 THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(v_item->'choices') <> 'array' THEN
      CONTINUE;
    END IF;

    SELECT array_agg(DISTINCT btrim(c))
      INTO v_choices
      FROM jsonb_array_elements_text(v_item->'choices') AS c
      WHERE btrim(c) <> '' AND length(btrim(c)) <= 200;

    IF v_choices IS NULL
       OR array_length(v_choices, 1) < 2
       OR array_length(v_choices, 1) > 4
       OR NOT (v_answer = ANY (v_choices)) THEN
      CONTINUE;
    END IF;

    v_diff := CASE lower(COALESCE(v_item->>'difficulty', 'medium'))
      WHEN 'easy' THEN 1
      WHEN 'hard' THEN 5
      ELSE 3
    END;

    INSERT INTO public.wordup_handcrafted_questions
      (category, prompt, choices, answer, explanation, difficulty, source, expires_at)
    VALUES
      (p_category, v_prompt, v_choices, v_answer,
       format('The correct answer is "%s".', v_answer),
       v_diff, 'opentdb', NOW() + make_interval(days => v_ttl))
    ON CONFLICT (prompt) DO UPDATE
      SET expires_at = EXCLUDED.expires_at
      WHERE public.wordup_handcrafted_questions.source = 'opentdb';

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.upsert_curated_otdb_questions(TEXT, JSONB, INT) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. Self-scoped seen recorder (used when a prefetched match is consumed)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_my_handcrafted_seen(
  p_question_ids UUID[]
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL OR array_length(p_question_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.wordup_user_handcrafted_history (user_id, question_id, seen_at)
  SELECT auth.uid(), q, NOW()
  FROM unnest(p_question_ids) q
  WHERE EXISTS (SELECT 1 FROM public.wordup_handcrafted_questions hq WHERE hq.id = q)
  ON CONFLICT (user_id, question_id) DO UPDATE SET seen_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_my_handcrafted_seen(UUID[]) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Daily safety-net cleanup (03:30 UTC)
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-curated-questions') THEN
    PERFORM cron.unschedule('cleanup-expired-curated-questions');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-expired-curated-questions',
  '30 3 * * *',
  $$SELECT public.cleanup_expired_curated_questions(30)$$
);
