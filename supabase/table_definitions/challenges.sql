create table public.challenges (
  id uuid not null default gen_random_uuid (),
  creator_id uuid not null,
  mode character varying(20) not null,
  word_length integer not null,
  target_word text not null,
  max_time integer null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone null default now(),
  salt character varying(50) null default ''::character varying,
  is_public boolean null default false,
  max_participants integer null,
  is_custom_word boolean null default false,
  handicap_starter character varying(10) null default null::character varying,
  handicap_starters jsonb null,
  handicap_enforced boolean null default false,
  marathon_timers jsonb null,
  marathon_force_order boolean null default false,
  handicap_starter_is_random boolean null default false,
  disable_hints boolean null default false,
  is_bot_marathon boolean not null default false,
  constraint challenges_pkey primary key (id),
  constraint challenges_creator_id_fkey foreign KEY (creator_id) references profiles (id),
  constraint challenges_mode_check check (
    (
      (mode)::text = any (
        (
          array[
            'LIVE'::character varying,
            'ANYTIME'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint challenges_word_length_check check (
    (
      (word_length >= 1)
      and (word_length <= 10)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_challenges_discover_event on public.challenges using btree (expires_at) TABLESPACE pg_default
where
  (
    (is_public = true)
    or (is_bot_marathon = true)
  );

create trigger trigger_invalidate_challenge_cache
after
update on challenges for EACH row
execute FUNCTION handle_challenge_cache_invalidation ();