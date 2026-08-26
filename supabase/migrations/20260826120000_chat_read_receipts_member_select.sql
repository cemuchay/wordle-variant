-- Enables WhatsApp-style read receipts: members can read each other's
-- last-seen timestamps for conversations they share, powering blue ticks
-- and "Seen by" message-info panels.
--
-- Apply via: supabase db push  (or paste into the Supabase SQL editor)

drop policy if exists "members_can_read_group_receipts" on public.chat_read_receipts;

create policy "members_can_read_group_receipts"
on public.chat_read_receipts
for select
to authenticated
using (
   user_id = auth.uid()
   or exists (
      select 1
      from public.chat_group_members m
      where m.group_id = chat_read_receipts.group_id
        and m.user_id = auth.uid()
        and m.status = 'joined'
   )
);
