-- DM Customization: Word Effects & Custom Nicknames for 1-on-1 DM conversations.
-- Apply via: supabase db push (or paste into the Supabase SQL editor)

-- 1. DM Word Effects (word/phrase -> emoji shower)
create table if not exists public.dm_word_effects (
   id uuid primary key default gen_random_uuid(),
   group_id uuid not null references public.chat_groups(id) on delete cascade,
   trigger_word text not null check (char_length(btrim(trigger_word)) between 1 and 40),
   emoji text not null check (char_length(btrim(emoji)) between 1 and 16),
   created_by uuid not null references auth.users(id) on delete cascade,
   created_at timestamptz not null default now()
);

create unique index if not exists idx_dm_word_effects_group_word
   on public.dm_word_effects (group_id, lower(trigger_word));

create index if not exists idx_dm_word_effects_group_id
   on public.dm_word_effects (group_id);

alter table public.dm_word_effects enable row level security;

drop policy if exists "dm_members_manage_word_effects" on public.dm_word_effects;
create policy "dm_members_manage_word_effects"
on public.dm_word_effects
for all
to authenticated
using (
   exists (
      select 1
      from public.chat_groups g
      join public.chat_group_members m
        on m.group_id = g.id
      where g.id = dm_word_effects.group_id
        and g.type = 'dm'
        and m.user_id = auth.uid()
        and m.status = 'joined'
   )
)
with check (
   exists (
      select 1
      from public.chat_groups g
      join public.chat_group_members m
        on m.group_id = g.id
      where g.id = dm_word_effects.group_id
        and g.type = 'dm'
        and m.user_id = auth.uid()
        and m.status = 'joined'
   )
);

-- 2. DM Custom Nicknames (either participant can set/clear nickname for other or self)
create table if not exists public.dm_nicknames (
   group_id uuid not null references public.chat_groups(id) on delete cascade,
   target_user_id uuid not null references auth.users(id) on delete cascade,
   nickname text not null check (char_length(btrim(nickname)) between 1 and 32),
   updated_by uuid not null references auth.users(id) on delete cascade,
   updated_at timestamptz not null default now(),
   primary key (group_id, target_user_id)
);

create index if not exists idx_dm_nicknames_group_id
   on public.dm_nicknames (group_id);

alter table public.dm_nicknames enable row level security;

drop policy if exists "dm_members_manage_nicknames" on public.dm_nicknames;
create policy "dm_members_manage_nicknames"
on public.dm_nicknames
for all
to authenticated
using (
   exists (
      select 1
      from public.chat_groups g
      join public.chat_group_members m
        on m.group_id = g.id
      where g.id = dm_nicknames.group_id
        and g.type = 'dm'
        and m.user_id = auth.uid()
        and m.status = 'joined'
   )
)
with check (
   exists (
      select 1
      from public.chat_groups g
      join public.chat_group_members m
        on m.group_id = g.id
      where g.id = dm_nicknames.group_id
        and g.type = 'dm'
        and m.user_id = auth.uid()
        and m.status = 'joined'
   )
   and exists (
      select 1
      from public.chat_group_members tm
      where tm.group_id = dm_nicknames.group_id
        and tm.user_id = dm_nicknames.target_user_id
        and tm.status = 'joined'
   )
);

-- 3. Enable Realtime for both tables (idempotent)
do $$
begin
   if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'dm_word_effects'
   ) then
      alter publication supabase_realtime add table public.dm_word_effects;
   end if;

   if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'dm_nicknames'
   ) then
      alter publication supabase_realtime add table public.dm_nicknames;
   end if;
end $$;
