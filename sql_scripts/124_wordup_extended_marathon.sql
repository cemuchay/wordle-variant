-- 124_wordup_extended_marathon.sql

-- Add extended marathon columns to wordup_matches
ALTER TABLE public.wordup_matches
ADD COLUMN IF NOT EXISTS is_marathon BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS allow_pause BOOLEAN DEFAULT FALSE;

-- Add extended marathon columns to wordup_async_matches
ALTER TABLE public.wordup_async_matches
ADD COLUMN IF NOT EXISTS is_marathon BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS allow_pause BOOLEAN DEFAULT FALSE;
