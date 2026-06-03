create table public.guest_profiles (
  id uuid not null default gen_random_uuid (),
  username character varying(50) not null,
  avatar_url text null,
  created_at timestamp with time zone null default now(),
  constraint guest_profiles_pkey primary key (id)
) TABLESPACE pg_default;