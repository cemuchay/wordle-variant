-- 149_wordup_synthetic_bot_profiles.sql
-- Upgrades WordUp bot system to support persistent, location-aware synthetic user profiles
-- with realistic avatars, personalities, match history, and leaderboard rankings.

-- 1. Add bot columns to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS country_code VARCHAR(8) NULL;

-- Drop strict foreign key from profiles.id -> auth.users.id so synthetic bot profiles
-- can reside in public.profiles and satisfy all foreign keys & PostgREST joins across
-- wordup_profiles, wordup_category_profiles, and wordup_matches.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Add bot columns to public.wordup_profiles
ALTER TABLE public.wordup_profiles
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bot_personality JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_wordup_profiles_is_bot_rating
ON public.wordup_profiles (is_bot, rating);

CREATE INDEX IF NOT EXISTS idx_profiles_is_bot_country
ON public.profiles (is_bot, country_code);

-- 3. Ensure welcome email trigger skips synthetic bot accounts
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  ef_url TEXT;
  ef_secret TEXT;
  headers_json JSONB;
  body_json JSONB;
  user_email TEXT;
BEGIN
  -- Skip synthetic bot profiles
  IF COALESCE(NEW.is_bot, FALSE) = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RAISE WARNING 'Cache / system settings not configured. Skipping welcome email trigger.';
    RETURN NEW;
  END IF;

  ef_url := REPLACE(ef_url, 'redis-cache', 'email-notifications');

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  headers_json := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', ef_secret
  );

  body_json := jsonb_build_object(
    'action', 'welcome-email',
    'email', user_email,
    'username', NEW.username,
    'userId', NEW.id
  );

  PERFORM net.http_post(
    url := ef_url,
    headers := headers_json,
    body := body_json
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger welcome email for user ID %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update handle_new_wordup_profile trigger to carry over is_bot flag
CREATE OR REPLACE FUNCTION public.handle_new_wordup_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wordup_profiles (id, is_bot)
  VALUES (NEW.id, COALESCE(NEW.is_bot, FALSE))
  ON CONFLICT (id) DO UPDATE SET is_bot = EXCLUDED.is_bot;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Spawn or Fetch a WordUp Synthetic Opponent Profile
CREATE OR REPLACE FUNCTION public.spawn_or_fetch_wordup_bot(
  p_target_rating INTEGER DEFAULT 600,
  p_category VARCHAR DEFAULT 'mixed',
  p_region VARCHAR DEFAULT 'NG',
  p_force_spawn BOOLEAN DEFAULT FALSE,
  p_exclude_bot_id UUID DEFAULT NULL,
  p_spawn_payload JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_bot RECORD;
  v_new_id UUID;
  v_username TEXT;
  v_avatar_url TEXT;
  v_country_code VARCHAR(8);
  v_initial_rating INTEGER;
  v_initial_xp INTEGER;
  v_games_played INTEGER;
  v_games_won INTEGER;
  v_games_lost INTEGER;
  v_games_tied INTEGER;
  v_rank_name VARCHAR(50);
  v_personality JSONB;
  v_cat_rating INTEGER;
  v_cat_rank_name VARCHAR(50);
BEGIN
  -- 1. Try to reuse an existing bot profile near target rating if not forcing a fresh spawn
  IF NOT COALESCE(p_force_spawn, FALSE) THEN
    SELECT
      wp.id,
      pr.username,
      pr.avatar_url,
      pr.country_code,
      wp.rating AS global_rating,
      wp.xp,
      wp.games_played,
      wp.games_won,
      wp.games_lost,
      wp.games_tied,
      wp.rank_name,
      wp.bot_personality,
      COALESCE(cp.rating, wp.rating) AS effective_rating,
      COALESCE(cp.rank_name, wp.rank_name) AS effective_rank_name
    INTO v_bot
    FROM public.wordup_profiles wp
    JOIN public.profiles pr ON pr.id = wp.id
    LEFT JOIN public.wordup_category_profiles cp
      ON cp.user_id = wp.id AND cp.category = p_category
    WHERE wp.is_bot = TRUE
      AND pr.is_bot = TRUE
      AND wp.id != '00000000-0000-0000-0000-000000000b0b'
      AND (p_exclude_bot_id IS NULL OR wp.id != p_exclude_bot_id)
      AND ABS(COALESCE(cp.rating, wp.rating) - p_target_rating) <= 300
    ORDER BY
      (CASE WHEN pr.country_code = p_region THEN 0 ELSE 1 END) ASC,
      RANDOM()
    LIMIT 1;

    IF v_bot.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_bot.id,
        'username', v_bot.username,
        'avatar_url', v_bot.avatar_url,
        'country_code', v_bot.country_code,
        'rating', v_bot.effective_rating,
        'global_rating', v_bot.global_rating,
        'xp', v_bot.xp,
        'games_played', v_bot.games_played,
        'games_won', v_bot.games_won,
        'games_lost', v_bot.games_lost,
        'games_tied', v_bot.games_tied,
        'rank_name', v_bot.effective_rank_name,
        'is_bot', TRUE,
        'bot_personality', v_bot.bot_personality,
        'spawned_new', FALSE
      );
    END IF;
  END IF;

  -- 2. Spawn a new synthetic bot profile from p_spawn_payload
  IF p_spawn_payload IS NULL THEN
    RAISE EXCEPTION 'p_spawn_payload is required when spawning a new bot profile';
  END IF;

  v_new_id := COALESCE((p_spawn_payload->>'id')::UUID, gen_random_uuid());
  v_username := COALESCE(p_spawn_payload->>'username', 'Player_' || SUBSTRING(v_new_id::TEXT, 1, 5));
  v_avatar_url := p_spawn_payload->>'avatar_url';
  v_country_code := COALESCE(p_spawn_payload->>'country_code', p_region, 'NG');
  v_initial_rating := GREATEST(600, COALESCE((p_spawn_payload->>'rating')::INTEGER, p_target_rating, 600));
  v_initial_xp := GREATEST(0, COALESCE((p_spawn_payload->>'xp')::INTEGER, 150));
  v_games_played := GREATEST(1, COALESCE((p_spawn_payload->>'games_played')::INTEGER, 3));
  v_games_won := GREATEST(0, COALESCE((p_spawn_payload->>'games_won')::INTEGER, 2));
  v_games_lost := GREATEST(0, COALESCE((p_spawn_payload->>'games_lost')::INTEGER, 1));
  v_games_tied := GREATEST(0, COALESCE((p_spawn_payload->>'games_tied')::INTEGER, 0));
  v_personality := COALESCE(p_spawn_payload->'bot_personality', '{}'::JSONB);

  v_rank_name := CASE
    WHEN v_initial_rating >= 1700 THEN 'Master'
    WHEN v_initial_rating >= 1400 THEN 'Diamond'
    WHEN v_initial_rating >= 1100 THEN 'Gold'
    WHEN v_initial_rating >= 800 THEN 'Silver'
    ELSE 'Bronze'
  END;

  -- Ensure username uniqueness in public.profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(v_username)) THEN
    v_username := SUBSTRING(v_username, 1, 11) || '_' || SUBSTRING(REPLACE(v_new_id::TEXT, '-', ''), 1, 3);
  END IF;

  -- Insert into public.profiles
  INSERT INTO public.profiles (id, username, avatar_url, is_bot, country_code, updated_at, last_seen_at)
  VALUES (v_new_id, v_username, v_avatar_url, TRUE, v_country_code, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    is_bot = TRUE,
    country_code = EXCLUDED.country_code,
    last_seen_at = NOW();

  -- Upsert into public.wordup_profiles
  INSERT INTO public.wordup_profiles (
    id, rating, xp, games_played, games_won, games_lost, games_tied, rank_name, is_bot, bot_personality, updated_at
  )
  VALUES (
    v_new_id, v_initial_rating, v_initial_xp, v_games_played, v_games_won, v_games_lost, v_games_tied, v_rank_name, TRUE, v_personality, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    rating = EXCLUDED.rating,
    xp = EXCLUDED.xp,
    games_played = EXCLUDED.games_played,
    games_won = EXCLUDED.games_won,
    games_lost = EXCLUDED.games_lost,
    games_tied = EXCLUDED.games_tied,
    rank_name = EXCLUDED.rank_name,
    is_bot = TRUE,
    bot_personality = EXCLUDED.bot_personality,
    updated_at = NOW();

  -- Upsert into public.wordup_category_profiles if specific category
  v_cat_rating := v_initial_rating;
  v_cat_rank_name := v_rank_name;
  IF p_category IS NOT NULL AND p_category != '' THEN
    INSERT INTO public.wordup_category_profiles (
      user_id, category, rating, xp, games_played, games_won, games_lost, games_tied, rank_name, updated_at
    )
    VALUES (
      v_new_id, p_category, v_cat_rating, v_initial_xp, v_games_played, v_games_won, v_games_lost, v_games_tied, v_cat_rank_name, NOW()
    )
    ON CONFLICT (user_id, category) DO UPDATE SET
      rating = EXCLUDED.rating,
      xp = EXCLUDED.xp,
      games_played = EXCLUDED.games_played,
      games_won = EXCLUDED.games_won,
      games_lost = EXCLUDED.games_lost,
      games_tied = EXCLUDED.games_tied,
      rank_name = EXCLUDED.rank_name,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'username', v_username,
    'avatar_url', v_avatar_url,
    'country_code', v_country_code,
    'rating', v_cat_rating,
    'global_rating', v_initial_rating,
    'xp', v_initial_xp,
    'games_played', v_games_played,
    'games_won', v_games_won,
    'games_lost', v_games_lost,
    'games_tied', v_games_tied,
    'rank_name', v_cat_rank_name,
    'is_bot', TRUE,
    'bot_personality', v_personality,
    'spawned_new', TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.spawn_or_fetch_wordup_bot(INTEGER, VARCHAR, VARCHAR, BOOLEAN, UUID, JSONB) TO anon, authenticated;

-- 6. RPC: Record WordUp Bot Match Result (Updates Bot Global & Category Rankings + History)
CREATE OR REPLACE FUNCTION public.record_wordup_bot_match_result(
  p_bot_id UUID,
  p_category VARCHAR,
  p_elo_gain INTEGER,
  p_xp_reward INTEGER,
  p_played_inc INTEGER DEFAULT 1,
  p_won_inc INTEGER DEFAULT 0,
  p_lost_inc INTEGER DEFAULT 0,
  p_tied_inc INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  v_cur_rating INTEGER;
  v_new_rating INTEGER;
  v_new_rank VARCHAR(50);
  v_cat_rating INTEGER;
  v_new_cat_rating INTEGER;
  v_new_cat_rank VARCHAR(50);
BEGIN
  IF p_bot_id IS NULL OR p_bot_id = '00000000-0000-0000-0000-000000000b0b' THEN
    RETURN;
  END IF;

  -- 1. Update global wordup_profiles for the bot
  SELECT rating INTO v_cur_rating
  FROM public.wordup_profiles
  WHERE id = p_bot_id AND is_bot = TRUE;

  IF v_cur_rating IS NOT NULL THEN
    v_new_rating := GREATEST(600, v_cur_rating + COALESCE(p_elo_gain, 0));
    v_new_rank := CASE
      WHEN v_new_rating >= 1700 THEN 'Master'
      WHEN v_new_rating >= 1400 THEN 'Diamond'
      WHEN v_new_rating >= 1100 THEN 'Gold'
      WHEN v_new_rating >= 800 THEN 'Silver'
      ELSE 'Bronze'
    END;

    UPDATE public.wordup_profiles
    SET
      rating = v_new_rating,
      xp = xp + GREATEST(0, COALESCE(p_xp_reward, 0)),
      games_played = games_played + GREATEST(1, COALESCE(p_played_inc, 1)),
      games_won = games_won + GREATEST(0, COALESCE(p_won_inc, 0)),
      games_lost = games_lost + GREATEST(0, COALESCE(p_lost_inc, 0)),
      games_tied = games_tied + GREATEST(0, COALESCE(p_tied_inc, 0)),
      rank_name = v_new_rank,
      updated_at = NOW()
    WHERE id = p_bot_id;

    UPDATE public.profiles
    SET last_seen_at = NOW(), updated_at = NOW()
    WHERE id = p_bot_id AND is_bot = TRUE;
  END IF;

  -- 2. Upsert category profile for the bot
  IF p_category IS NOT NULL AND p_category != '' THEN
    SELECT rating INTO v_cat_rating
    FROM public.wordup_category_profiles
    WHERE user_id = p_bot_id AND category = p_category;

    v_new_cat_rating := GREATEST(600, COALESCE(v_cat_rating, v_cur_rating, 600) + COALESCE(p_elo_gain, 0));
    v_new_cat_rank := CASE
      WHEN v_new_cat_rating >= 1700 THEN 'Master'
      WHEN v_new_cat_rating >= 1400 THEN 'Diamond'
      WHEN v_new_cat_rating >= 1100 THEN 'Gold'
      WHEN v_new_cat_rating >= 800 THEN 'Silver'
      ELSE 'Bronze'
    END;

    INSERT INTO public.wordup_category_profiles (
      user_id, category, rating, xp, games_played, games_won, games_lost, games_tied, rank_name, updated_at
    )
    VALUES (
      p_bot_id,
      p_category,
      v_new_cat_rating,
      GREATEST(0, COALESCE(p_xp_reward, 0)),
      GREATEST(1, COALESCE(p_played_inc, 1)),
      GREATEST(0, COALESCE(p_won_inc, 0)),
      GREATEST(0, COALESCE(p_lost_inc, 0)),
      GREATEST(0, COALESCE(p_tied_inc, 0)),
      v_new_cat_rank,
      NOW()
    )
    ON CONFLICT (user_id, category) DO UPDATE SET
      rating = v_new_cat_rating,
      xp = public.wordup_category_profiles.xp + GREATEST(0, COALESCE(p_xp_reward, 0)),
      games_played = public.wordup_category_profiles.games_played + GREATEST(1, COALESCE(p_played_inc, 1)),
      games_won = public.wordup_category_profiles.games_won + GREATEST(0, COALESCE(p_won_inc, 0)),
      games_lost = public.wordup_category_profiles.games_lost + GREATEST(0, COALESCE(p_lost_inc, 0)),
      games_tied = public.wordup_category_profiles.games_tied + GREATEST(0, COALESCE(p_tied_inc, 0)),
      rank_name = v_new_cat_rank,
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_wordup_bot_match_result(UUID, VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated;

