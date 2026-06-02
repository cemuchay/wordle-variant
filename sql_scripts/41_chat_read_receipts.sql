-- 41_chat_read_receipts.sql
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, group_id)
);

-- Enable RLS
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Read Policy: Users can only query their own read receipts
DROP POLICY IF EXISTS "Users can view their own read receipts" ON public.chat_read_receipts;
CREATE POLICY "Users can view their own read receipts"
ON public.chat_read_receipts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Insert/Update Policy: Users can only manage their own read receipts
DROP POLICY IF EXISTS "Users can manage their own read receipts" ON public.chat_read_receipts;
CREATE POLICY "Users can manage their own read receipts"
ON public.chat_read_receipts FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
