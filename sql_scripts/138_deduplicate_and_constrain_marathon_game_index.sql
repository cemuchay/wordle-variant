-- 138_deduplicate_and_constrain_marathon_game_index.sql
-- Description:
-- 1. Cleans up any existing duplicate entries in `challenge_participants_marathon`
--    for the same (participation_id, challenge_id, game_index), prioritizing rows with:
--      a) status = 'completed'
--      b) status = 'timed_out' over 'playing'
--      c) highest score
--      d) latest completed_at / started_at
-- 2. Enforces a UNIQUE constraint on (participation_id, challenge_id, game_index)
--    so multiple rows cannot exist for the same game index under the same participant and challenge.

-- Step 1: Remove existing duplicate rows
WITH ranked_marathons AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY participation_id, challenge_id, game_index
      ORDER BY
        CASE 
          WHEN status = 'completed' THEN 1
          WHEN status = 'timed_out' THEN 2
          ELSE 3
        END ASC,
        COALESCE(score, 0) DESC,
        completed_at DESC NULLS LAST,
        started_at DESC NULLS LAST,
        id DESC
    ) AS rank_num
  FROM public.challenge_participants_marathon
)
DELETE FROM public.challenge_participants_marathon
WHERE id IN (
  SELECT id
  FROM ranked_marathons
  WHERE rank_num > 1
);

-- Step 2: Add unique constraint to prevent duplicate game_index entries per participant and challenge
ALTER TABLE public.challenge_participants_marathon
  ADD CONSTRAINT challenge_participants_marathon_part_chal_game_idx_unique
  UNIQUE (participation_id, challenge_id, game_index);

-- Step 3: Create index for optimized lookups
CREATE INDEX IF NOT EXISTS idx_marathon_participation_challenge_game_idx
  ON public.challenge_participants_marathon (participation_id, challenge_id, game_index);
