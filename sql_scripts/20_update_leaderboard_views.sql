-- 20_update_leaderboard_views.sql
-- Update weekly and monthly leaderboard views to include user_id and grant permissions

-- 1. Weekly Leaderboard View
DROP VIEW IF EXISTS public.leaderboard_weekly CASCADE;

CREATE OR REPLACE VIEW public.leaderboard_weekly AS
WITH lagos_time AS (
  SELECT timezone('Africa/Lagos', now())::date AS lagos_date
),
weekly_bounds AS (
  SELECT (lagos_date - (EXTRACT(ISODOW FROM lagos_date)::integer - 1))::date AS week_start
  FROM lagos_time
)
SELECT 
    p.username,
    p.avatar_url,
    s.user_id,
    COALESCE(SUM(s.skill_score), 0) AS total_points,
    COUNT(DISTINCT s.game_date) AS days_active
FROM public.scores s
JOIN public.profiles p ON s.user_id = p.id
CROSS JOIN weekly_bounds wb
WHERE (s.game_date::text)::date >= wb.week_start
  AND (s.game_date::text)::date < wb.week_start + 7
GROUP BY p.username, p.avatar_url, s.user_id;

-- Grant permissions to access the view
GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;


-- 2. Monthly Leaderboard View
DROP VIEW IF EXISTS public.leaderboard_monthly CASCADE;

CREATE OR REPLACE VIEW public.leaderboard_monthly AS
WITH lagos_time AS (
  SELECT timezone('Africa/Lagos', now())::date AS lagos_date
),
monthly_bounds AS (
  SELECT DATE_TRUNC('month', lagos_date)::date AS month_start
  FROM lagos_time
)
SELECT 
    p.username,
    p.avatar_url,
    s.user_id,
    COALESCE(SUM(s.skill_score), 0) AS total_points,
    COUNT(DISTINCT s.game_date) AS days_active
FROM public.scores s
JOIN public.profiles p ON s.user_id = p.id
CROSS JOIN monthly_bounds mb
WHERE (s.game_date::text)::date >= mb.month_start
  AND (s.game_date::text)::date < (mb.month_start + INTERVAL '1 month')::date
GROUP BY p.username, p.avatar_url, s.user_id;

-- Grant permissions to access the view
GRANT SELECT ON public.leaderboard_monthly TO anon, authenticated;
