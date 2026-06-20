-- 63_wordup_rating_default_to_600.sql

-- 1. Alter the column default on the WordUp profiles table to 600
alter table public.wordup_profiles
alter column rating
set default 600;

-- 2. reset all beta games to 0 and rating 600 and Bronze rank
update public.wordup_profiles
set
  rating = 600,
  rank_name = 'Bronze',
  xp = 0,
  games_played = 0,
  games_won = 0,
  games_lost = 0,
  games_tied = 0;