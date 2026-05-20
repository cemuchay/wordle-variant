-- Fix RLS policies for anonymous profiles and participation
-- This ensures that guest users can properly create their profiles and join challenges

-- 1. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Profiles policies for everyone (including anonymous)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow profile inserts by anyone" ON public.profiles;
CREATE POLICY "Allow profile inserts by anyone" 
ON public.profiles FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow profile updates by owners" ON public.profiles;
CREATE POLICY "Allow profile updates by owners" 
ON public.profiles FOR UPDATE 
TO public 
USING (auth.uid() = id OR auth.uid() IS NULL)
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- 3. Ensure challenge_participants has correct public policies
DROP POLICY IF EXISTS "Participants are viewable by everyone" ON public.challenge_participants;
CREATE POLICY "Participants are viewable by everyone" 
ON public.challenge_participants FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Anyone can join challenges" ON public.challenge_participants;
CREATE POLICY "Anyone can join challenges" 
ON public.challenge_participants FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own participation" ON public.challenge_participants;
CREATE POLICY "Users can update own participation" 
ON public.challenge_participants FOR UPDATE 
TO public 
USING (auth.uid() = user_id OR auth.uid() IS NULL)
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);
