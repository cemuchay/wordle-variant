-- Add marathon_force_order column to challenges table to support sequential unlocking in Marathon mode
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS marathon_force_order BOOLEAN DEFAULT FALSE;
