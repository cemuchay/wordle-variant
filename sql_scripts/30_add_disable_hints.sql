-- Migration to add disable_hints column to challenges table
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS disable_hints BOOLEAN DEFAULT FALSE;
