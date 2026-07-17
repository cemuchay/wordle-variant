-- 1. For fetching challenges created by the user
CREATE INDEX idx_challenges_creator_id 
ON challenges (creator_id);

-- 2. For the participants query with the OR condition
-- Postgres uses a fast "Bitmap OR" scan when both columns have separate indexes
CREATE INDEX idx_challenge_participants_user_id 
ON challenge_participants (user_id);

CREATE INDEX idx_challenge_participants_guest_id 
ON challenge_participants (guest_id);

CREATE INDEX idx_challenge_participants_id_score 
ON challenge_participants (challenge_id, score DESC);

-- (Note: The final query that fetches recently viewed challenges uses .in("id", missingIds). Since id is the Primary Key, Postgres automatically indexes it, so no action is needed there.)