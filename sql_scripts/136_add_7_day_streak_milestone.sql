-- ====================================================================
-- SQL Script 136: Add 7-Day Streak Milestone Award Constraint & Migration
-- ====================================================================

-- Step 1: Ensure user_awards table check constraint allows 'streak_7' award type
ALTER TABLE user_awards DROP CONSTRAINT IF EXISTS user_awards_award_type_check;

ALTER TABLE user_awards ADD CONSTRAINT user_awards_award_type_check 
  CHECK (award_type IN (
    'weekly_champion',
    'monthly_champion',
    'bot_marathon_weekly',
    'streak_7',
    'streak_50',
    'streak_100',
    'streak_250',
    'streak_365',
    'streak_500',
    'streak_1000'
  ));

-- Step 2: Retroactively grant 7-day streak awards for all qualifying users
WITH won_dates AS (
  SELECT DISTINCT
    user_id,
    game_date::date AS g_date
  FROM scores
  WHERE status = 'won'
),
streak_groups AS (
  SELECT
    user_id,
    g_date,
    g_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY g_date))::integer AS streak_grp
  FROM won_dates
),
streak_runs AS (
  SELECT
    user_id,
    g_date,
    ROW_NUMBER() OVER (PARTITION BY user_id, streak_grp ORDER BY g_date) AS streak_length
  FROM streak_groups
),
milestones AS (
  SELECT user_id, 7 AS milestone, 'streak_7' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 7 GROUP BY user_id
)
INSERT INTO user_awards (user_id, award_type, period_key, score, awarded_at)
SELECT
  user_id,
  award_type,
  award_type AS period_key,
  milestone AS score,
  milestone_date::timestamp AS awarded_at
FROM milestones
ON CONFLICT (user_id, award_type, period_key) DO NOTHING;
