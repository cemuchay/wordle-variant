create or replace view user_dashboard_stats 
with (security_invoker = true) as 
select 
  u.id as user_id,
  
  -- 1. Aggregate daily scores into a JSON array
  coalesce(
    (select json_agg(s) 
     from (
       select game_date, status, skill_score, attempts 
       from public.scores 
       where user_id = u.id
     ) s
    ), '[]'::json
  ) as daily_scores,
  
  -- 2. Aggregate target user's challenge participations
  coalesce(
    (select json_agg(p) 
     from (
       select cp.id, cp.challenge_id, cp.status, cp.score, cp.attempts, cp.completed_at,
              (select to_jsonb(c) from public.challenges c where c.id = cp.challenge_id) as challenge
       from public.challenge_participants cp
       where cp.user_id = u.id
     ) p
    ), '[]'::json
  ) as challenge_participations,

  -- 3. Aggregate ALL participants for the challenges this user completed/timed_out
  coalesce(
    (select json_agg(ap)
     from (
       select challenge_id, user_id, score, status 
       from public.challenge_participants 
       where challenge_id in (
         select challenge_id 
         from public.challenge_participants 
         where user_id = u.id and status in ('completed', 'timed_out')
       )
     ) ap
    ), '[]'::json
  ) as all_challenge_participations

from public.profiles u; --  Uses public profiles table instead of auth.users