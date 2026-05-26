-- Migration to add handicap_starter_is_random column to challenges table
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS handicap_starter_is_random BOOLEAN DEFAULT FALSE;
