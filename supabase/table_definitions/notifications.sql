create table public.notifications (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  type character varying(50) not null,
  title character varying(255) not null,
  message text not null,
  data jsonb null default '{}'::jsonb,
  is_read boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_created on public.notifications using btree (user_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_unread on public.notifications using btree (user_id) TABLESPACE pg_default
where
  (is_read = false);

create index IF not exists idx_notifications_user_id on public.notifications using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_notifications_created_at on public.notifications using btree (created_at desc) TABLESPACE pg_default;