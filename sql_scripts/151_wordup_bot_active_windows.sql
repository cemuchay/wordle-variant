-- 151_wordup_bot_active_windows.sql
-- Adds timezone-aware active time window checks for WordUp synthetic bots
-- so bots only appear online during realistic hours for their persona & timezone.

-- 1. Helper: Evaluate whether a synthetic bot is currently in an active time window
CREATE OR REPLACE FUNCTION public.is_bot_active_now(
  p_bot_id UUID,
  p_personality JSONB,
  p_country_code VARCHAR DEFAULT 'NG'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_schedule JSONB;
  v_tz TEXT;
  v_local_ts TIMESTAMP;
  v_dow INTEGER;
  v_is_weekend BOOLEAN;
  v_minute INTEGER;
  v_windows JSONB;
  v_win JSONB;
  v_start INTEGER;
  v_end INTEGER;
  v_bucket INTEGER;
BEGIN
  v_schedule := CASE
    WHEN p_personality IS NOT NULL AND jsonb_typeof(p_personality->'schedule') = 'object'
    THEN p_personality->'schedule'
    ELSE NULL
  END;

  -- Resolve timezone from schedule or fallback by country_code
  v_tz := COALESCE(
    NULLIF(v_schedule->>'timeZone', ''),
    CASE UPPER(COALESCE(p_country_code, 'NG'))
      WHEN 'NG' THEN 'Africa/Lagos'
      WHEN 'GH' THEN 'Africa/Accra'
      WHEN 'KE' THEN 'Africa/Nairobi'
      WHEN 'ZA' THEN 'Africa/Johannesburg'
      WHEN 'GB' THEN 'Europe/London'
      WHEN 'US' THEN 'America/New_York'
      WHEN 'CA' THEN 'America/Toronto'
      WHEN 'AU' THEN 'Australia/Sydney'
      WHEN 'IN' THEN 'Asia/Kolkata'
      WHEN 'FR' THEN 'Europe/Paris'
      WHEN 'DE' THEN 'Europe/Berlin'
      WHEN 'ES' THEN 'Europe/Madrid'
      WHEN 'BR' THEN 'America/Sao_Paulo'
      ELSE 'Africa/Lagos'
    END
  );

  BEGIN
    v_local_ts := NOW() AT TIME ZONE v_tz;
  EXCEPTION
    WHEN OTHERS THEN
      v_local_ts := NOW() AT TIME ZONE 'Africa/Lagos';
  END;

  v_dow := EXTRACT(DOW FROM v_local_ts)::INTEGER; -- 0 = Sunday, 6 = Saturday
  v_is_weekend := (v_dow = 0 OR v_dow = 6);
  v_minute := (EXTRACT(HOUR FROM v_local_ts)::INTEGER * 60) + EXTRACT(MINUTE FROM v_local_ts)::INTEGER;

  -- Path A: Bot has an explicit schedule in bot_personality.schedule
  IF v_schedule IS NOT NULL THEN
    v_windows := CASE
      WHEN v_is_weekend THEN v_schedule->'weekendWindows'
      ELSE v_schedule->'weekdayWindows'
    END;

    IF v_windows IS NULL OR jsonb_typeof(v_windows) != 'array' OR jsonb_array_length(v_windows) = 0 THEN
      RETURN FALSE;
    END IF;

    FOR v_win IN SELECT value FROM jsonb_array_elements(v_windows)
    LOOP
      v_start := ((COALESCE((v_win->>'startMinute')::INTEGER, 0) % 1440) + 1440) % 1440;
      v_end := ((COALESCE((v_win->>'endMinute')::INTEGER, 0) % 1440) + 1440) % 1440;

      IF v_start = v_end THEN
        RETURN TRUE;
      ELSIF v_start < v_end THEN
        IF v_minute >= v_start AND v_minute <= v_end THEN
          RETURN TRUE;
        END IF;
      ELSE
        -- Overnight wrap-around (e.g., 21:30 -> 03:30)
        IF v_minute >= v_start OR v_minute <= v_end THEN
          RETURN TRUE;
        END IF;
      END IF;
    END LOOP;

    RETURN FALSE;
  END IF;

  -- Path B: Legacy bots without explicit schedule get a deterministic lifestyle bucket
  v_bucket := ABS(hashtext(COALESCE(p_bot_id::TEXT, 'legacy'))) % 6;

  IF v_is_weekend THEN
    RETURN CASE v_bucket
      WHEN 0 THEN (v_minute BETWEEN 600 AND 870) OR (v_minute >= 1080 OR v_minute <= 90)     -- student
      WHEN 1 THEN (v_minute BETWEEN 570 AND 780) OR (v_minute BETWEEN 960 AND 1380)          -- nine_to_five
      WHEN 2 THEN (v_minute BETWEEN 660 AND 900) OR (v_minute BETWEEN 1140 AND 1410)         -- remote_freelancer
      WHEN 3 THEN (v_minute BETWEEN 840 AND 1080) OR (v_minute >= 1320 OR v_minute <= 270)   -- night_owl
      WHEN 4 THEN (v_minute BETWEEN 390 AND 660) OR (v_minute BETWEEN 900 AND 1230)          -- early_bird
      ELSE        (v_minute BETWEEN 540 AND 750) OR (v_minute BETWEEN 1020 AND 1350)         -- shift_trader
    END;
  ELSE
    RETURN CASE v_bucket
      WHEN 0 THEN (v_minute BETWEEN 510 AND 600) OR (v_minute BETWEEN 840 AND 1050) OR (v_minute >= 1200 OR v_minute <= 30)  -- student
      WHEN 1 THEN (v_minute BETWEEN 420 AND 525) OR (v_minute BETWEEN 720 AND 825) OR (v_minute BETWEEN 1065 AND 1350)       -- nine_to_five
      WHEN 2 THEN (v_minute BETWEEN 570 AND 720) OR (v_minute BETWEEN 870 AND 1080) OR (v_minute BETWEEN 1230 AND 1410)      -- remote_freelancer
      WHEN 3 THEN (v_minute BETWEEN 780 AND 960) OR (v_minute >= 1290 OR v_minute <= 210)                                    -- night_owl
      WHEN 4 THEN (v_minute BETWEEN 330 AND 510) OR (v_minute BETWEEN 750 AND 840) OR (v_minute BETWEEN 1110 AND 1260)       -- early_bird
      ELSE        (v_minute BETWEEN 480 AND 660) OR (v_minute BETWEEN 810 AND 990) OR (v_minute BETWEEN 1170 AND 1320)       -- shift_trader
    END;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.is_bot_active_now(UUID, JSONB, VARCHAR) TO anon, authenticated;

-- 2. Update spawn_or_fetch_wordup_bot so reused bots must be inside an active local time window
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
  -- 1. Try to reuse an existing bot profile near target rating that is ACTIVE RIGHT NOW in its timezone
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
      AND public.is_bot_active_now(wp.id, wp.bot_personality, pr.country_code) = TRUE
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
