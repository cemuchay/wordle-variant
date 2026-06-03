create table public.scores (
  id bigserial not null,
  user_id uuid null,
  game_date date not null,
  word_length integer not null,
  attempts integer not null,
  hints_used boolean null default false,
  skill_score integer not null,
  created_at timestamp with time zone null default now(),
  guesses jsonb null default '[]'::jsonb,
  status text null default 'playing'::text,
  hint_record jsonb null,
  game_message text null,
  constraint scores_pkey primary key (id),
  constraint scores_user_id_game_date_key unique (user_id, game_date),
  constraint unique_user_game_date unique (user_id, game_date),
  constraint fk_scores_user_id foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint scores_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_scores_agg_lookup on public.scores using btree (status, game_date, skill_score, user_id) TABLESPACE pg_default;

create trigger trigger_invalidate_score_cache
after INSERT
or
update on scores for EACH row
execute FUNCTION handle_score_cache_invalidation ();

create trigger trigger_score_overtaken
after INSERT
or
update on scores for EACH row
execute FUNCTION handle_score_overtaken ();

create trigger trigger_update_awards_on_score
after INSERT
or DELETE
or
update on scores for EACH row
execute FUNCTION handle_scores_awards_update ();