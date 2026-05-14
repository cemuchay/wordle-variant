-- Update Challenge Participants INSERT policy to allow creators to invite others
-- The previous policy only allowed a user to insert themselves.

DROP POLICY IF EXISTS "Authenticated users can join challenges" ON public.challenge_participants;

CREATE POLICY "Users can join challenges or creators can invite others"
ON public.challenge_participants FOR INSERT
TO authenticated
WITH CHECK (
    -- Case 1: User is joining themselves
    (auth.uid() = user_id)
    OR 
    -- Case 2: User is the creator of the challenge and is adding someone else
    EXISTS (
        SELECT 1 FROM public.challenges
        WHERE challenges.id = challenge_id
        AND challenges.creator_id = auth.uid()
    )
);
