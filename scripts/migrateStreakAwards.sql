-- ====================================================================
-- One-off SQL Migration Script: Retroactive Streak Milestone Awards
-- ====================================================================

-- Step 1: UNDO / Purge any previously inserted streak awards
DELETE FROM user_awards WHERE award_type LIKE 'streak_%';

-- Step 2: Ensure check constraint allows streak award types
ALTER TABLE user_awards DROP CONSTRAINT IF EXISTS user_awards_award_type_check;

ALTER TABLE user_awards ADD CONSTRAINT user_awards_award_type_check 
  CHECK (award_type IN (
    'weekly_champion',
    'monthly_champion',
    'bot_marathon_weekly',
    'streak_50',
    'streak_100',
    'streak_250',
    'streak_365',
    'streak_500',
    'streak_1000'
  ));

-- Step 3: Setup Row Level Security (RLS) Policies on user_awards
ALTER TABLE user_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own awards" ON user_awards;
CREATE POLICY "Users can insert their own awards" 
ON user_awards 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own awards" ON user_awards;
CREATE POLICY "Users can update their own awards" 
ON user_awards 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view user awards" ON user_awards;
CREATE POLICY "Anyone can view user awards" 
ON user_awards 
FOR SELECT 
TO public 
USING (true);

-- Step 4: Calculate TRUE consecutive calendar-day winning streaks for all users
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
  SELECT user_id, 50 AS milestone, 'streak_50' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 50 GROUP BY user_id
  UNION ALL
  SELECT user_id, 100 AS milestone, 'streak_100' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 100 GROUP BY user_id
  UNION ALL
  SELECT user_id, 250 AS milestone, 'streak_250' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 250 GROUP BY user_id
  UNION ALL
  SELECT user_id, 365 AS milestone, 'streak_365' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 365 GROUP BY user_id
  UNION ALL
  SELECT user_id, 500 AS milestone, 'streak_500' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 500 GROUP BY user_id
  UNION ALL
  SELECT user_id, 1000 AS milestone, 'streak_1000' AS award_type, MIN(g_date) AS milestone_date FROM streak_runs WHERE streak_length >= 1000 GROUP BY user_id
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
