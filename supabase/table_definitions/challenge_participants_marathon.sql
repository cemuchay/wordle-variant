create table public.challenge_participants_marathon (
  id uuid not null default gen_random_uuid (),
  participation_id uuid not null,
  word_length integer not null,
  status character varying(20) not null default 'playing'::character varying,
  score integer null default 0,
  attempts integer null default 0,
  guesses jsonb null default '[]'::jsonb,
  hints_used boolean null default false,
  hint_record jsonb null,
  started_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  time_taken integer null,
  game_index integer not null default 0,
  challenge_id uuid not null,
  play_date date not null default '1970-01-01'::date,
  constraint challenge_participants_marathon_pkey primary key (id),
  constraint challenge_participants_marathon_participation_id_game_index_pla unique (participation_id, game_index, play_date),
  constraint challenge_participants_marathon_challenge_id_fkey foreign KEY (challenge_id) references challenges (id) on delete CASCADE,
  constraint challenge_participants_marathon_participation_id_fkey foreign KEY (participation_id) references challenge_participants (id) on delete CASCADE,
  constraint challenge_participants_marathon_status_check check (
    (
      (status)::text = any (
        (
          array[
            'playing'::character varying,
            'completed'::character varying,
            'timed_out'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint challenge_participants_marathon_word_length_check check (
    (
      (word_length >= 3)
      and (word_length <= 10)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_marathon_challenge_id on public.challenge_participants_marathon using btree (challenge_id) TABLESPACE pg_default;

create trigger trigger_invalidate_marathon_cache
after INSERT
or DELETE
or
update on challenge_participants_marathon for EACH row
execute FUNCTION handle_marathon_cache_invalidation ();

create trigger trigger_marathon_game_completed
after INSERT
or
update on challenge_participants_marathon for EACH row
execute FUNCTION handle_marathon_game_completed ();