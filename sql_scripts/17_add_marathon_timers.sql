-- Add marathon_timers column to challenges table to support custom timers per length in Marathon mode
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS marathon_timers JSONB DEFAULT NULL;
