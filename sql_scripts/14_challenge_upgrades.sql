-- 1. Alter challenges table to add new fields for customization, handicap, and limits
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_custom_word BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS handicap_starter VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS handicap_starters JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS handicap_enforced BOOLEAN DEFAULT FALSE;

-- 2. Update RLS policies to allow anonymous/public access to view challenges and participate
-- Drop old select policies first to avoid conflicts
DROP POLICY IF EXISTS "Challenges are viewable by all authenticated users" ON public.challenges;
DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON public.challenges;

CREATE POLICY "Challenges are viewable by everyone" 
ON public.challenges FOR SELECT 
TO public
USING (true);

-- Drop old participant policies
DROP POLICY IF EXISTS "Participants are viewable by all authenticated users" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants are viewable by everyone" ON public.challenge_participants;

CREATE POLICY "Participants are viewable by everyone" 
ON public.challenge_participants FOR SELECT 
TO public
USING (true);

-- Allow anyone to join challenges (authenticated and anonymous)
DROP POLICY IF EXISTS "Users can join challenges or creators can invite others" ON public.challenge_participants;
DROP POLICY IF EXISTS "Anyone can join challenges" ON public.challenge_participants;

CREATE POLICY "Anyone can join challenges" 
ON public.challenge_participants FOR INSERT 
TO public
WITH CHECK (true);

-- Allow anyone to update their own participation status/guesses
DROP POLICY IF EXISTS "Users can update their own participation status" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON public.challenge_participants;

CREATE POLICY "Users can update own participation" 
ON public.challenge_participants FOR UPDATE 
TO public
USING (auth.uid() = user_id OR auth.uid() IS NULL)
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Repeat for marathon progress table
DROP POLICY IF EXISTS "Marathon participants are viewable by all authenticated users" ON public.challenge_participants_marathon;
DROP POLICY IF EXISTS "Marathon participants are viewable by everyone" ON public.challenge_participants_marathon;

CREATE POLICY "Marathon participants are viewable by everyone" 
ON public.challenge_participants_marathon FOR SELECT 
TO public
USING (true);

DROP POLICY IF EXISTS "Users can insert their own marathon progress" ON public.challenge_participants_marathon;
DROP POLICY IF EXISTS "Anyone can insert marathon progress" ON public.challenge_participants_marathon;

CREATE POLICY "Anyone can insert marathon progress" 
ON public.challenge_participants_marathon FOR INSERT 
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own marathon progress" ON public.challenge_participants_marathon;
DROP POLICY IF EXISTS "Anyone can update marathon progress" ON public.challenge_participants_marathon;

CREATE POLICY "Anyone can update marathon progress" 
ON public.challenge_participants_marathon FOR UPDATE 
TO public
USING (true)
WITH CHECK (true);

-- 3. Profiles policies - Allow anonymous profile insertion
DROP POLICY IF EXISTS "Profiles are insertable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile inserts by anyone" ON public.profiles;

CREATE POLICY "Allow profile inserts by anyone" 
ON public.profiles FOR INSERT 
TO public
WITH CHECK (true);
