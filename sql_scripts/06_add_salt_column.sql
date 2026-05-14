-- Add salt column to challenges for word obfuscation
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS salt VARCHAR(50) DEFAULT '';
