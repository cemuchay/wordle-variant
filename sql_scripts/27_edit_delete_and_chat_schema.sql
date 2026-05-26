-- 1. Add DELETE policy for challenges
DROP POLICY IF EXISTS "Creators can delete their own challenges if no one has played" ON public.challenges;
CREATE POLICY "Creators can delete their own challenges if no one has played"
ON public.challenges FOR DELETE
TO public
USING (
  auth.uid() = creator_id
  AND NOT EXISTS (
    SELECT 1 FROM public.challenge_participants 
    WHERE challenge_id = id 
      AND (status IN ('playing', 'completed', 'timed_out') OR attempts > 0)
  )
);

-- 2. Add UPDATE policy for challenges
DROP POLICY IF EXISTS "Creators can update their own challenges if no one has played" ON public.challenges;
CREATE POLICY "Creators can update their own challenges if no one has played"
ON public.challenges FOR UPDATE
TO public
USING (
  auth.uid() = creator_id
  AND NOT EXISTS (
    SELECT 1 FROM public.challenge_participants 
    WHERE challenge_id = id 
      AND (status IN ('playing', 'completed', 'timed_out') OR attempts > 0)
  )
)
WITH CHECK (
  auth.uid() = creator_id
);

-- 3. Add DELETE policy for challenge participants (to allow updating invited list during edit)
DROP POLICY IF EXISTS "Creators or users can delete pending participants" ON public.challenge_participants;
CREATE POLICY "Creators or users can delete pending participants"
ON public.challenge_participants FOR DELETE
TO public
USING (
  (status = 'pending' OR status = 'declined')
  AND (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id
        AND c.creator_id = auth.uid()
    )
  )
);

-- 4. Create Challenge Messages Table
CREATE TABLE IF NOT EXISTS public.challenge_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_sender_id UUID REFERENCES public.guest_profiles(id) ON DELETE SET NULL,
    sender_name VARCHAR(50) NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS on Challenge Messages
ALTER TABLE public.challenge_messages ENABLE ROW LEVEL SECURITY;

-- 6. Select policy for Challenge Messages (Only challenge creator or participants)
DROP POLICY IF EXISTS "Select messages by challenge members" ON public.challenge_messages;
CREATE POLICY "Select messages by challenge members"
ON public.challenge_messages FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id
      AND (
        c.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.challenge_participants cp
          WHERE cp.challenge_id = c.id
            AND (cp.user_id = auth.uid() OR auth.uid() IS NULL)
        )
      )
  )
);

-- 7. Insert policy for Challenge Messages (Only challenge creator or participants)
DROP POLICY IF EXISTS "Insert messages by challenge members" ON public.challenge_messages;
CREATE POLICY "Insert messages by challenge members"
ON public.challenge_messages FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id
      AND (
        c.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.challenge_participants cp
          WHERE cp.challenge_id = c.id
            AND (cp.user_id = auth.uid() OR auth.uid() IS NULL)
        )
      )
  )
  AND (
    (auth.uid() IS NOT NULL AND sender_id = auth.uid() AND guest_sender_id IS NULL)
    OR
    (auth.uid() IS NULL AND sender_id IS NULL AND guest_sender_id IS NOT NULL)
  )
);

-- 8. Add to Realtime Publication (if publication exists)
-- Safe wrapper to add table to publication, ignore if already exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
