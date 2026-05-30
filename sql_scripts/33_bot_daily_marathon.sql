-- 33_bot_daily_marathon.sql

-- 1. Alter public.challenges to add is_bot_marathon
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS is_bot_marathon BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Alter public.challenge_participants_marathon to add play_date
ALTER TABLE public.challenge_participants_marathon ADD COLUMN IF NOT EXISTS play_date DATE DEFAULT '1970-01-01' NOT NULL;

-- 3. Replace unique constraint on challenge_participants_marathon
-- This allows a user to have multiple entries for the same game_index in a challenge, as long as they are on different dates.
-- For regular challenges, play_date will default to '1970-01-01', so the behavior remains the same.
ALTER TABLE public.challenge_participants_marathon 
DROP CONSTRAINT IF EXISTS challenge_participants_marathon_participation_id_game_index_key;

ALTER TABLE public.challenge_participants_marathon 
DROP CONSTRAINT IF EXISTS challenge_participants_marathon_participation_id_game_index_pla;

ALTER TABLE public.challenge_participants_marathon 
ADD CONSTRAINT challenge_participants_marathon_participation_id_game_index_play_date_key 
UNIQUE (participation_id, game_index, play_date);

-- 4. Create public.bot_marathon_daily_words table
CREATE TABLE IF NOT EXISTS public.bot_marathon_daily_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    play_date DATE NOT NULL,
    word_length INTEGER NOT NULL CHECK (word_length >= 3 AND word_length <= 7),
    target_word VARCHAR(10) NOT NULL,
    salt VARCHAR(50) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(play_date, word_length)
);

-- Enable RLS for bot_marathon_daily_words
ALTER TABLE public.bot_marathon_daily_words ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read daily words
DROP POLICY IF EXISTS "Daily words are viewable by all authenticated users" ON public.bot_marathon_daily_words;
CREATE POLICY "Daily words are viewable by all authenticated users"
ON public.bot_marathon_daily_words FOR SELECT
TO authenticated
USING (true);

-- 5. Seed system User for Variant Bot (Trigger handles public.profiles automatically)
INSERT INTO auth.users (id, instance_id, email, aud, role, raw_user_meta_data, is_sso_user)
VALUES (
    '00000000-0000-0000-0000-000000000b0b',
    '00000000-0000-0000-0000-000000000000',
    'bot@variant.internal',
    'authenticated',
    'authenticated',
    jsonb_build_object(
        'iss', 'supabase',
        'sub', '00000000-0000-0000-0000-000000000b0b',
        'full_name', 'Variant Bot',
        'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=VariantBot'
    ),
    FALSE
)
ON CONFLICT (id) DO NOTHING;