-- Migration: Add guess_timestamps column to scores, challenge_participants, and challenge_participants_marathon tables

ALTER TABLE public.scores 
ADD COLUMN IF NOT EXISTS guess_timestamps jsonb null default '[]'::jsonb;

ALTER TABLE public.challenge_participants 
ADD COLUMN IF NOT EXISTS guess_timestamps jsonb null default '[]'::jsonb;

ALTER TABLE public.challenge_participants_marathon 
ADD COLUMN IF NOT EXISTS guess_timestamps jsonb null default '[]'::jsonb;
