-- 99_exclude_current_period_from_awards.sql
-- Exclude current partial periods from daily/weekly/monthly win counters
-- so that only fully completed periods count toward lifetime totals.

CREATE OR REPLACE FUNCTION public.recalculate_all_awards()
RETURNS VOID AS $$
DECLARE
  current_week_start date := (CURRENT_DATE - (EXTRACT(ISODOW FROM CURRENT_DATE)::integer - 1));
  current_month_start date := DATE_TRUNC('month', CURRENT_DATE)::date;
BEGIN
  -- Reset all counters
  UPDATE public.profiles
  SET daily_wins = 0,
      weekly_wins = 0,
      monthly_wins = 0
  WHERE true;

  -- A. Daily Wins — exclude today
  WITH daily_max AS (
    SELECT game_date, MAX(skill_score) as max_score
    FROM public.scores
    WHERE status = 'won'
      AND game_date < CURRENT_DATE
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

  -- B. Weekly Wins — exclude current week
  WITH user_weekly_scores AS (
    SELECT
      user_id,
      (game_date::date - (EXTRACT(ISODOW FROM game_date::date)::integer - 1))::date as week_start,
      SUM(skill_score) as total_score
    FROM public.scores
    WHERE status = 'won'
      AND (game_date::date - (EXTRACT(ISODOW FROM game_date::date)::integer - 1))::date < current_week_start
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

  -- C. Monthly Wins — exclude current month
  WITH user_monthly_scores AS (
    SELECT
      user_id,
      DATE_TRUNC('month', game_date::date)::date as month_start,
      SUM(skill_score) as total_score
    FROM public.scores
    WHERE status = 'won'
      AND DATE_TRUNC('month', game_date::date)::date < current_month_start
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

-- Run recalculation once to backfill
SELECT public.recalculate_all_awards();
