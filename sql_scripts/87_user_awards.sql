-- 87_user_awards.sql
-- Awards system: individual award records for weekly, monthly, and bot marathon champions.
-- Enables reigning badges (previous ISO week) and a full awards history in profile modals.

-- ============================================
-- 1. Helper functions for ISO week calculation
-- ============================================

CREATE OR REPLACE FUNCTION public.get_iso_week_key(p_date DATE)
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(p_date, 'IYYY-"W"IW');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_previous_iso_week_key()
RETURNS TEXT AS $$
DECLARE
  lagos_today DATE := timezone('Africa/Lagos', NOW())::date;
  this_week_monday DATE := lagos_today - (EXTRACT(ISODOW FROM lagos_today)::integer - 1);
  prev_week_monday DATE := this_week_monday - 7;
BEGIN
  RETURN TO_CHAR(prev_week_monday, 'IYYY-"W"IW');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. Create user_awards table
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    award_type TEXT NOT NULL CHECK (award_type IN ('weekly_champion', 'monthly_champion', 'bot_marathon_weekly')),
    period_key TEXT NOT NULL,
    score INTEGER,
    metadata JSONB DEFAULT '{}',
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, award_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_user_awards_lookup ON public.user_awards (award_type, period_key);
CREATE INDEX IF NOT EXISTS idx_user_awards_user ON public.user_awards (user_id);

ALTER TABLE public.user_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_awards_select" ON public.user_awards;
CREATE POLICY "user_awards_select" ON public.user_awards
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- 3. Award functions
-- ============================================

CREATE OR REPLACE FUNCTION public.award_weekly_champions(week_key TEXT)
RETURNS VOID AS $$
DECLARE
  week_start DATE;
  week_end DATE;
BEGIN
  week_start := TO_DATE(week_key || '-1', 'IYYY-"W"IW-ID');
  week_end := week_start + 7;

  DELETE FROM public.user_awards WHERE award_type = 'weekly_champion' AND period_key = week_key;

  INSERT INTO public.user_awards (user_id, award_type, period_key, score)
  SELECT user_id, 'weekly_champion', week_key, SUM(skill_score) as total_score
  FROM public.scores
  WHERE status = 'won'
    AND game_date >= week_start
    AND game_date < week_end
  GROUP BY user_id
  HAVING SUM(skill_score) = (
    SELECT MAX(total) FROM (
      SELECT SUM(skill_score) as total
      FROM public.scores
      WHERE status = 'won'
        AND game_date >= week_start
        AND game_date < week_end
      GROUP BY user_id
    ) sub
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.award_monthly_champions(month_key TEXT)
RETURNS VOID AS $$
DECLARE
  month_start DATE;
  month_end DATE;
BEGIN
  month_start := TO_DATE(month_key || '-01', 'YYYY-MM-DD');
  month_end := (month_start + INTERVAL '1 month')::date;

  DELETE FROM public.user_awards WHERE award_type = 'monthly_champion' AND period_key = month_key;

  INSERT INTO public.user_awards (user_id, award_type, period_key, score)
  SELECT user_id, 'monthly_champion', month_key, SUM(skill_score) as total_score
  FROM public.scores
  WHERE status = 'won'
    AND game_date >= month_start
    AND game_date < month_end
  GROUP BY user_id
  HAVING SUM(skill_score) = (
    SELECT MAX(total) FROM (
      SELECT SUM(skill_score) as total
      FROM public.scores
      WHERE status = 'won'
        AND game_date >= month_start
        AND game_date < month_end
      GROUP BY user_id
    ) sub
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.award_bot_marathon_weekly(week_key TEXT)
RETURNS VOID AS $$
DECLARE
  week_start DATE;
  week_end DATE;
BEGIN
  week_start := TO_DATE(week_key || '-1', 'IYYY-"W"IW-ID');
  week_end := week_start + 7;

  DELETE FROM public.user_awards WHERE award_type = 'bot_marathon_weekly' AND period_key = week_key;

  INSERT INTO public.user_awards (user_id, award_type, period_key, score)
  SELECT cp.user_id, 'bot_marathon_weekly', week_key, SUM(cp.score) as total_score
  FROM public.challenge_participants cp
  JOIN public.challenges ch ON cp.challenge_id = ch.id
  WHERE ch.is_bot_marathon = true
    AND cp.status = 'completed'
    AND cp.completed_at >= week_start
    AND cp.completed_at < week_end
    AND cp.user_id IS NOT NULL
  GROUP BY cp.user_id
  HAVING SUM(cp.score) = (
    SELECT MAX(total) FROM (
      SELECT SUM(cp2.score) as total
      FROM public.challenge_participants cp2
      JOIN public.challenges ch2 ON cp2.challenge_id = ch2.id
      WHERE ch2.is_bot_marathon = true
        AND cp2.status = 'completed'
        AND cp2.completed_at >= week_start
        AND cp2.completed_at < week_end
        AND cp2.user_id IS NOT NULL
      GROUP BY cp2.user_id
    ) sub
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.award_all_current_periods()
RETURNS VOID AS $$
DECLARE
  current_week TEXT;
  current_month TEXT;
  lagos_date DATE;
BEGIN
  lagos_date := timezone('Africa/Lagos', NOW())::date;
  current_week := public.get_iso_week_key(lagos_date);
  current_month := TO_CHAR(lagos_date, 'YYYY-MM');

  PERFORM public.award_weekly_champions(current_week);
  PERFORM public.award_monthly_champions(current_month);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Reigning badge lookup function
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_reigning_badges(p_user_id UUID)
RETURNS TABLE (is_reigning_weekly BOOLEAN, is_reigning_bot_marathon BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM public.user_awards WHERE user_id = p_user_id AND award_type = 'weekly_champion' AND period_key = public.get_previous_iso_week_key()) AS is_reigning_weekly,
    EXISTS(SELECT 1 FROM public.user_awards WHERE user_id = p_user_id AND award_type = 'bot_marathon_weekly' AND period_key = public.get_previous_iso_week_key()) AS is_reigning_bot_marathon;
END;
$$;

-- ============================================
-- 5. Triggers
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_score_award_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_all_current_periods();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_award_weekly_champion ON public.scores;
CREATE TRIGGER trigger_award_weekly_champion
AFTER INSERT OR UPDATE OR DELETE ON public.scores
FOR EACH STATEMENT
EXECUTE FUNCTION public.handle_score_award_trigger();

CREATE OR REPLACE FUNCTION public.handle_bot_marathon_award_trigger()
RETURNS TRIGGER AS $$
DECLARE
  is_bot BOOLEAN;
BEGIN
  SELECT ch.is_bot_marathon INTO is_bot
  FROM public.challenges ch
  WHERE ch.id = NEW.challenge_id;

  IF COALESCE(is_bot, FALSE) AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.award_bot_marathon_weekly(
      public.get_iso_week_key(timezone('Africa/Lagos', NEW.completed_at)::date)
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_award_bot_marathon ON public.challenge_participants;
CREATE TRIGGER trigger_award_bot_marathon
AFTER INSERT OR UPDATE OF status ON public.challenge_participants
FOR EACH ROW
WHEN (NEW.status = 'completed' AND NEW.user_id IS NOT NULL)
EXECUTE FUNCTION public.handle_bot_marathon_award_trigger();

-- ============================================
-- 5. Retroactive backfill
-- ============================================

DO $$
DECLARE
  week_key TEXT;
  month_key TEXT;
  min_game_date DATE;
  first_monday DATE;
  first_of_month DATE;
  min_challenge_date TIMESTAMPTZ;
  first_monday_bot DATE;
  num_weeks INT;
  num_months INT;
  i INT;
BEGIN
  SELECT MIN(game_date) INTO min_game_date FROM public.scores;

  IF min_game_date IS NOT NULL THEN
    first_monday := TO_DATE(TO_CHAR(min_game_date, 'IYYY-"W"IW') || '-1', 'IYYY-"W"IW-ID');
    num_weeks := CEIL((CURRENT_DATE - first_monday)::float / 7)::integer;

    FOR i IN 0..num_weeks LOOP
      week_key := public.get_iso_week_key((first_monday + i * 7)::date);
      PERFORM public.award_weekly_champions(week_key);
    END LOOP;

    first_of_month := DATE_TRUNC('month', min_game_date)::date;
    num_months := (EXTRACT(YEAR FROM age(CURRENT_DATE, first_of_month)) * 12
                   + EXTRACT(MONTH FROM age(CURRENT_DATE, first_of_month)))::integer;

    FOR i IN 0..num_months LOOP
      month_key := TO_CHAR((first_of_month + (i || ' months')::interval)::date, 'YYYY-MM');
      PERFORM public.award_monthly_champions(month_key);
    END LOOP;
  END IF;

  SELECT MIN(cp.completed_at) INTO min_challenge_date
  FROM public.challenge_participants cp
  JOIN public.challenges ch ON cp.challenge_id = ch.id
  WHERE ch.is_bot_marathon = true AND cp.status = 'completed';

  IF min_challenge_date IS NOT NULL THEN
    first_monday_bot := TO_DATE(TO_CHAR(min_challenge_date::date, 'IYYY-"W"IW') || '-1', 'IYYY-"W"IW-ID');
    num_weeks := CEIL((CURRENT_DATE - first_monday_bot)::float / 7)::integer;

    FOR i IN 0..num_weeks LOOP
      week_key := public.get_iso_week_key((first_monday_bot + i * 7)::date);
      PERFORM public.award_bot_marathon_weekly(week_key);
    END LOOP;
  END IF;
END;
$$;

-- ============================================
-- 6. Verification queries (run manually)
-- ============================================
-- SELECT award_type, period_key, COUNT(*) as winners
-- FROM public.user_awards
-- GROUP BY award_type, period_key
-- ORDER BY period_key DESC
-- LIMIT 20;
--
-- SELECT COUNT(*) AS total_awards FROM public.user_awards;
