-- 42_add_scores_profiles_fk.sql
-- Add foreign key constraint to link scores with profiles for PostgREST joins.

-- First, ensure all scores refer to a valid profile. If any orphan records exist, delete them.
DELETE FROM public.scores 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Add the foreign key constraint
ALTER TABLE public.scores
ADD CONSTRAINT fk_scores_user_id
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
