-- Fix foreign keys to reference public.profiles instead of auth.users
-- This allows PostgREST to perform joins between these tables

ALTER TABLE public.challenges 
DROP CONSTRAINT IF EXISTS challenges_creator_id_fkey;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES public.profiles(id);

ALTER TABLE public.challenge_participants
DROP CONSTRAINT IF EXISTS challenge_participants_user_id_fkey;

ALTER TABLE public.challenge_participants
ADD CONSTRAINT challenge_participants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);
