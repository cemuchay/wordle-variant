-- Increase length of target_word to accommodate hashed/obfuscated strings
ALTER TABLE public.challenges 
ALTER COLUMN target_word TYPE TEXT;
