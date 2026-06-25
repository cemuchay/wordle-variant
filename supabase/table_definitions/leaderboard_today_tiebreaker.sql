-- Recreate leaderboard_today view with MIN(created_at) as tiebreaker
-- This ensures tied players are ordered by earliest play time

drop view if exists public.leaderboard_today;

create view public.leaderboard_today as
select
  p.username,
  p.avatar_url,
  s.word_length,
  s.attempts,
  s.status,
  p.id as user_id,
  sum(s.skill_score) as total_points,
  min(s.created_at) as first_played_at
from
  profiles p
  join scores s on p.id = s.user_id
where
  s.game_date = (
    CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos'::text
  )::date
group by
  p.username,
  p.avatar_url,
  s.word_length,
  s.attempts,
  s.status,
  p.id;
