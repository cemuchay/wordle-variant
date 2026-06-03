create table public.profiles (
  id uuid not null,
  username text not null,
  avatar_url text null,
  updated_at timestamp with time zone null default now(),
  preferences jsonb not null default '{"theme": "dark", "allowRoasts": true, "compactMode": false}'::jsonb,
  last_seen_at timestamp with time zone null default now(),
  daily_wins integer null default 0,
  weekly_wins integer null default 0,
  monthly_wins integer null default 0,
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trigger_invalidate_profile_cache
after
update on profiles for EACH row
execute FUNCTION handle_profile_cache_invalidation ();

create trigger trigger_welcome_email_on_signup
after INSERT on profiles for EACH row
execute FUNCTION trigger_welcome_email ();