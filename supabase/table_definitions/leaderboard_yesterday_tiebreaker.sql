-- Add first_played_at to leaderboard_yesterday for tiebreaker support
-- Matches the pattern already applied to leaderboard_today in leaderboard_today_tiebreaker.sql

drop view if exists public.leaderboard_yesterday;

create view public.leaderboard_yesterday as
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
    (
      CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos'::text
    )::date - '1 day'::interval
  )
group by
  p.username,
  p.avatar_url,
  s.word_length,
  s.attempts,
  s.status,
  p.id;
