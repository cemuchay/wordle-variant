-- 16_add_profile_awards.sql

-- 1. Alter public.profiles table to add win counters
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_wins INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_wins INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_wins INT DEFAULT 0;

-- 2. Create indices on public.scores for fast aggregations
CREATE INDEX IF NOT EXISTS idx_scores_agg_lookup
ON public.scores (status, game_date, skill_score, user_id);

-- 3. Define the main function to recalculate all awards from scratch
CREATE OR REPLACE FUNCTION public.recalculate_all_awards()
RETURNS VOID AS $$
BEGIN
  -- Reset all counters
  UPDATE public.profiles
  SET daily_wins = 0,
      weekly_wins = 0,
      monthly_wins = 0
  WHERE true;

  -- A. Daily Wins
  WITH daily_max AS (
    SELECT game_date, MAX(skill_score) as max_score
    FROM public.scores
    WHERE status = 'won'
    GROUP BY game_date
  ),
  daily_winners AS (
    SELECT s.user_id, COUNT(*) as wins
    FROM public.scores s
    JOIN daily_max dm ON s.game_date = dm.game_date AND s.skill_score = dm.max_score
    WHERE s.status = 'won'
    GROUP BY s.user_id
  )
  UPDATE public.profiles p
  SET daily_wins = COALESCE(dw.wins, 0)
  FROM daily_winners dw
  WHERE p.id = dw.user_id;

  -- B. Weekly Wins
  WITH user_weekly_scores AS (
    SELECT
      user_id,
      (game_date::date - (EXTRACT(ISODOW FROM game_date::date)::integer - 1))::date as week_start,
      SUM(skill_score) as total_score
    FROM public.scores
    WHERE status = 'won'
    GROUP BY user_id, week_start
  ),
  weekly_max AS (
    SELECT week_start, MAX(total_score) as max_score
    FROM user_weekly_scores
    GROUP BY week_start
  ),
  weekly_winners AS (
    SELECT uws.user_id, COUNT(*) as wins
    FROM user_weekly_scores uws
    JOIN weekly_max wm ON uws.week_start = wm.week_start AND uws.total_score = wm.max_score
    WHERE uws.total_score > 0
    GROUP BY uws.user_id
  )
  UPDATE public.profiles p
  SET weekly_wins = COALESCE(ww.wins, 0)
  FROM weekly_winners ww
  WHERE p.id = ww.user_id;

  -- C. Monthly Wins
  WITH user_monthly_scores AS (
    SELECT
      user_id,
      DATE_TRUNC('month', game_date::date)::date as month_start,
      SUM(skill_score) as total_score
    FROM public.scores
    WHERE status = 'won'
    GROUP BY user_id, month_start
  ),
  monthly_max AS (
    SELECT month_start, MAX(total_score) as max_score
    FROM user_monthly_scores
    GROUP BY month_start
  ),
  monthly_winners AS (
    SELECT ums.user_id, COUNT(*) as wins
    FROM user_monthly_scores ums
    JOIN monthly_max mm ON ums.month_start = mm.month_start AND ums.total_score = mm.max_score
    WHERE ums.total_score > 0
    GROUP BY ums.user_id
  )
  UPDATE public.profiles p
  SET monthly_wins = COALESCE(mw.wins, 0)
  FROM monthly_winners mw
  WHERE p.id = mw.user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Execute the recalculation once retroactively for all existing data
SELECT public.recalculate_all_awards();

-- 5. Create a trigger on scores to keep awards up to date on new entries/changes
CREATE OR REPLACE FUNCTION public.handle_scores_awards_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger full recalculation
  PERFORM public.recalculate_all_awards();
  
  -- Invalidate cache for the affected user
  IF TG_OP = 'DELETE' THEN
    PERFORM public.request_cache_invalidation('profile:' || OLD.user_id);
  ELSE
    PERFORM public.request_cache_invalidation('profile:' || NEW.user_id);
    IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      PERFORM public.request_cache_invalidation('profile:' || OLD.user_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_awards_on_score ON public.scores;
CREATE TRIGGER trigger_update_awards_on_score
AFTER INSERT OR UPDATE OR DELETE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.handle_scores_awards_update();
