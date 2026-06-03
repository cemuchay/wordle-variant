create table public.challenge_messages (
  id uuid not null default gen_random_uuid (),
  challenge_id uuid not null,
  sender_id uuid null,
  guest_sender_id uuid null,
  sender_name character varying(50) not null,
  content text not null,
  created_at timestamp with time zone null default now(),
  reactions jsonb null default '{}'::jsonb,
  voice_url text null,
  image_url text null,
  constraint challenge_messages_pkey primary key (id),
  constraint challenge_messages_challenge_id_fkey foreign KEY (challenge_id) references challenges (id) on delete CASCADE,
  constraint challenge_messages_guest_sender_id_fkey foreign KEY (guest_sender_id) references guest_profiles (id) on delete set null,
  constraint challenge_messages_sender_id_fkey foreign KEY (sender_id) references profiles (id) on delete set null,
  constraint challenge_messages_content_check check ((char_length(content) <= 500))
) TABLESPACE pg_default;

create index IF not exists idx_challenge_messages_challenge_id on public.challenge_messages using btree (challenge_id) TABLESPACE pg_default;

create index IF not exists idx_challenge_messages_created_at on public.challenge_messages using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_challenge_messages_challenge_created on public.challenge_messages using btree (challenge_id, created_at) TABLESPACE pg_default;