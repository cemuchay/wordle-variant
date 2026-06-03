create view public.leaderboard_yesterday as
select
  p.username,
  p.avatar_url,
  s.word_length,
  s.attempts,
  s.status,
  p.id as user_id,
  sum(s.skill_score) as total_points
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