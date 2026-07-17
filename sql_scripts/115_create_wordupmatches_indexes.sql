-- Indexes for Live Matches
CREATE INDEX idx_wordup_matches_p1_completed 
ON wordup_matches (player1_id, completed_at DESC) 
WHERE status = 'completed';

CREATE INDEX idx_wordup_matches_p2_completed 
ON wordup_matches (player2_id, completed_at DESC) 
WHERE status = 'completed';

-- Indexes for Async Matches
CREATE INDEX idx_wordup_async_matches_p1_completed 
ON wordup_async_matches (player1_id, completed_at DESC) 
WHERE status = 'completed';

CREATE INDEX idx_wordup_async_matches_p2_completed 
ON wordup_async_matches (player2_id, completed_at DESC) 
WHERE status = 'completed';