-- 20261122093300_wordup_synthetic_bot_profiles.sql
-- Mirror of sql_scripts/149_wordup_synthetic_bot_profiles.sql for Supabase CLI migrations

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS country_code VARCHAR(8) NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.wordup_profiles
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bot_personality JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_wordup_profiles_is_bot_rating
ON public.wordup_profiles (is_bot, rating);

CREATE INDEX IF NOT EXISTS idx_profiles_is_bot_country
ON public.profiles (is_bot, country_code);

