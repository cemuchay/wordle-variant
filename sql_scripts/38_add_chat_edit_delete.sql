-- 38_add_chat_edit_delete.sql
-- Migration to support message editing and soft deletion with labels.

-- 1. Add columns to public.messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 2. Add columns to public.challenge_messages
ALTER TABLE public.challenge_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.challenge_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 3. Configure UPDATE policies for public.messages so users can edit or delete (soft delete via update) their own messages
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Configure UPDATE policies for public.challenge_messages
DROP POLICY IF EXISTS "Users can update their own challenge messages" ON public.challenge_messages;
CREATE POLICY "Users can update their own challenge messages"
ON public.challenge_messages FOR UPDATE
TO public
USING (
  (auth.uid() IS NOT NULL AND sender_id = auth.uid()) OR
  (auth.uid() IS NULL AND guest_sender_id IS NOT NULL)
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND sender_id = auth.uid()) OR
  (auth.uid() IS NULL AND guest_sender_id IS NOT NULL)
);
