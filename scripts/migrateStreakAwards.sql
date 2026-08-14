-- ====================================================================
-- One-off SQL Migration Script: Retroactive Streak Milestone Awards
-- ====================================================================
-- This script calculates historical streak progressions across the `scores` table
-- and populates `user_awards` with persistent milestone awards (50, 100, 250, 365, 500, 1000 days).

WITH RECURSIVE streak_calc AS (
  SELECT
    user_id,
    game_date,
    status,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY game_date) -
    ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY game_date) AS streak_grp
  FROM scores
  WHERE status = 'won'
),
streak_counts AS (
  SELECT
    user_id,
    game_date,
    ROW_NUMBER() OVER (PARTITION BY user_id, streak_grp ORDER BY game_date) AS streak_length
  FROM streak_calc
),
milestones AS (
  SELECT user_id, 50 AS milestone, 'streak_50' AS award_type, MIN(game_date) AS milestone_date FROM streak_counts WHERE streak_length >= 50 GROUP BY user_id
  UNION ALL
  SELECT user_id, 100 AS milestone, 'streak_100' AS award_type, MIN(game_date) AS milestone_date FROM streak_counts WHERE streak_length >= 100 GROUP BY user_id
  UNION ALL
  SELECT user_id, 250 AS milestone, 'streak_250' AS award_type, MIN(game_date) AS milestone_date FROM streak_counts WHERE streak_length >= 250 GROUP BY user_id
  UNION ALL
  SELECT user_id, 365 AS milestone, 'streak_365' AS award_type, MIN(game_date) AS milestone_date FROM streak_counts WHERE streak_length >= 365 GROUP BY user_id
  UNION ALL
  SELECT user_id, 500 AS milestone, 'streak_500' AS award_type, MIN(game_date) AS milestone_date FROM streak_counts WHERE streak_length >= 500 GROUP BY user_id
  UNION ALL
  SELECT user_id, 1000 AS milestone, 'streak_1000' AS award_type, MIN(game_date) AS milestone_date FROM streak_counts WHERE streak_length >= 1000 GROUP BY user_id
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
