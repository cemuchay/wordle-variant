-- Migration to alter handicap_starter from VARCHAR(10) to TEXT
-- This allows storing longer strings as well as stringified JSON arrays (e.g. '["DROP","RODE"]') without character limits

ALTER TABLE public.challenges 
ALTER COLUMN handicap_starter TYPE TEXT;

