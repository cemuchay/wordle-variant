-- Create chat_polls and chat_poll_votes tables for General group polls & Admin polls

CREATE TABLE IF NOT EXISTS public.chat_polls (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
   creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
   question TEXT NOT NULL CHECK (char_length(trim(question)) > 0),
   options JSONB NOT NULL,
   allow_change_vote BOOLEAN NOT NULL DEFAULT true,
   is_anonymous BOOLEAN NOT NULL DEFAULT false,
   is_admin_poll BOOLEAN NOT NULL DEFAULT false,
   is_pinned BOOLEAN NOT NULL DEFAULT false,
   pinned_at TIMESTAMPTZ,
   expires_at TIMESTAMPTZ NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   CONSTRAINT check_poll_options_count CHECK (jsonb_array_length(options) >= 2 AND jsonb_array_length(options) <= 6),
   CONSTRAINT check_poll_max_duration CHECK (expires_at <= created_at + interval '7 days 5 minutes')
);

-- Enforce maximum 1 pinned admin poll per group at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pinned_admin_poll
ON public.chat_polls (group_id)
WHERE is_admin_poll = true AND is_pinned = true;

-- Create chat_poll_votes table
CREATE TABLE IF NOT EXISTS public.chat_poll_votes (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   poll_id UUID NOT NULL REFERENCES public.chat_polls(id) ON DELETE CASCADE,
   user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
   option_id TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   CONSTRAINT unique_user_vote_per_poll UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_polls_group_id ON public.chat_polls(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll_id ON public.chat_poll_votes(poll_id);

-- Enable Row Level Security
ALTER TABLE public.chat_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_poll_votes ENABLE ROW LEVEL SECURITY;

-- Policies for chat_polls
DROP POLICY IF EXISTS "authenticated_can_read_polls" ON public.chat_polls;
CREATE POLICY "authenticated_can_read_polls"
ON public.chat_polls
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_can_create_polls" ON public.chat_polls;
CREATE POLICY "authenticated_can_create_polls"
ON public.chat_polls
FOR INSERT
TO authenticated
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "creator_or_admin_can_update_polls" ON public.chat_polls;
CREATE POLICY "creator_or_admin_can_update_polls"
ON public.chat_polls
FOR UPDATE
TO authenticated
USING (
   creator_id = auth.uid()
   OR EXISTS (
      SELECT 1 FROM public.admin_profile ap WHERE ap.id = auth.uid()
   )
);

DROP POLICY IF EXISTS "creator_or_admin_can_delete_polls" ON public.chat_polls;
CREATE POLICY "creator_or_admin_can_delete_polls"
ON public.chat_polls
FOR DELETE
TO authenticated
USING (
   creator_id = auth.uid()
   OR EXISTS (
      SELECT 1 FROM public.admin_profile ap WHERE ap.id = auth.uid()
   )
);

-- Policies for chat_poll_votes
DROP POLICY IF EXISTS "authenticated_can_read_poll_votes" ON public.chat_poll_votes;
CREATE POLICY "authenticated_can_read_poll_votes"
ON public.chat_poll_votes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_vote" ON public.chat_poll_votes;
CREATE POLICY "authenticated_can_insert_vote"
ON public.chat_poll_votes
FOR INSERT
TO authenticated
WITH CHECK (
   user_id = auth.uid()
   AND EXISTS (
      SELECT 1 FROM public.chat_polls p
      WHERE p.id = chat_poll_votes.poll_id
        AND p.expires_at > now()
   )
);

DROP POLICY IF EXISTS "authenticated_can_update_own_vote" ON public.chat_poll_votes;
CREATE POLICY "authenticated_can_update_own_vote"
ON public.chat_poll_votes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
   user_id = auth.uid()
   AND EXISTS (
      SELECT 1 FROM public.chat_polls p
      WHERE p.id = chat_poll_votes.poll_id
        AND p.allow_change_vote = true
        AND p.expires_at > now()
   )
);

