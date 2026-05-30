-- 34_admin_daily_challenge_rls.sql

-- 1. Update INSERT policy for public.challenges
DROP POLICY IF EXISTS "Authenticated users can create challenges" ON public.challenges;
CREATE POLICY "Authenticated users can create challenges"
ON public.challenges FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id OR public.is_admin());

-- 2. Update DELETE policy for public.challenges
-- Allows creators to delete, or admins to delete any challenge (even if hosted by Variant Bot)
DROP POLICY IF EXISTS "Creators can delete their own challenges if no one has played" ON public.challenges;
CREATE POLICY "Creators can delete their own challenges if no one has played"
ON public.challenges FOR DELETE
TO public
USING (
  (auth.uid() = creator_id OR public.is_admin())
  AND NOT EXISTS (
    SELECT 1 FROM public.challenge_participants 
    WHERE challenge_id = id 
      AND (status IN ('playing', 'completed', 'timed_out') OR attempts > 0)
  )
);

-- 3. Update UPDATE policy for public.challenges
-- Allows creators to update, or admins to update any challenge (even if hosted by Variant Bot)
DROP POLICY IF EXISTS "Creators can update their own challenges if no one has played" ON public.challenges;
CREATE POLICY "Creators can update their own challenges if no one has played"
ON public.challenges FOR UPDATE
TO public
USING (
  (auth.uid() = creator_id OR public.is_admin())
  AND NOT EXISTS (
    SELECT 1 FROM public.challenge_participants 
    WHERE challenge_id = id 
      AND (status IN ('playing', 'completed', 'timed_out') OR attempts > 0)
  )
)
WITH CHECK (
  auth.uid() = creator_id OR public.is_admin()
);

-- 4. Update DELETE policy for public.challenge_participants
-- Allows deletion of pending participants if user is participant, or creator of challenge, or if user is admin
DROP POLICY IF EXISTS "Creators or users can delete pending participants" ON public.challenge_participants;
CREATE POLICY "Creators or users can delete pending participants"
ON public.challenge_participants FOR DELETE
TO public
USING (
  (status = 'pending' OR status = 'declined')
  AND (
    auth.uid() = user_id 
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id
        AND c.creator_id = auth.uid()
    )
  )
);

-- 5. Performance Index for Discover Challenges
CREATE INDEX IF NOT EXISTS idx_challenges_discover_event
ON public.challenges (expires_at)
WHERE is_public = true OR is_bot_marathon = true;
