-- 57_add_max_attempts_to_challenges.sql
-- Add custom max attempts support to challenges

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 6;

-- Add a check constraint to ensure it's within a reasonable range (3 to 10)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenges_max_attempts_check') THEN
        ALTER TABLE public.challenges ADD CONSTRAINT challenges_max_attempts_check CHECK (max_attempts >= 3 AND max_attempts <= 10);
    END IF;
END $$;
