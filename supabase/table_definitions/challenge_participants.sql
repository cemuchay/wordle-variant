create table public.challenge_participants (
  id uuid not null default gen_random_uuid (),
  challenge_id uuid not null,
  user_id uuid null,
  status character varying(20) not null default 'pending'::character varying,
  score integer null default 0,
  attempts integer null default 0,
  guesses jsonb null default '[]'::jsonb,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  hints_used boolean null default false,
  hint_record jsonb null,
  time_taken integer null,
  guest_id uuid null,
  constraint challenge_participants_pkey primary key (id),
  constraint challenge_participants_challenge_id_fkey foreign KEY (challenge_id) references challenges (id) on delete CASCADE,
  constraint challenge_participants_guest_id_fkey foreign KEY (guest_id) references guest_profiles (id) on delete CASCADE,
  constraint challenge_participants_user_id_fkey foreign KEY (user_id) references profiles (id),
  constraint challenge_participants_status_check check (
    (
      (status)::text = any (
        (
          array[
            'pending'::character varying,
            'playing'::character varying,
            'completed'::character varying,
            'declined'::character varying,
            'timed_out'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint challenge_participants_user_or_guest check (
    (
      (
        (user_id is not null)
        and (guest_id is null)
      )
      or (
        (user_id is null)
        and (guest_id is not null)
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists challenge_participants_challenge_user_idx on public.challenge_participants using btree (challenge_id, user_id) TABLESPACE pg_default
where
  (user_id is not null);

create unique INDEX IF not exists challenge_participants_challenge_guest_idx on public.challenge_participants using btree (challenge_id, guest_id) TABLESPACE pg_default
where
  (guest_id is not null);

create trigger trigger_challenge_participant_completed
after
update on challenge_participants for EACH row
execute FUNCTION handle_challenge_participant_completed ();

create trigger trigger_challenge_participant_inserted
after INSERT on challenge_participants for EACH row
execute FUNCTION handle_challenge_participant_inserted ();

create trigger trigger_invalidate_challenge_participant_cache
after INSERT
or DELETE
or
update on challenge_participants for EACH row
execute FUNCTION handle_challenge_participant_cache_invalidation ();