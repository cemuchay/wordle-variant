-- ============================================================================
-- 148_evening_escalating_push_reminders.sql
--
-- Dynamic, Duolingo-style push notifications for players who haven't completed
-- today's game. Fires hourly from 6:00 PM to 11:00 PM WAT (17:00 to 22:00 UTC).
--
-- Conforms strictly to iOS (APNs/Safari Web Push) and Android PWA guidelines:
--  1) Titles stay strictly under 38 characters to avoid lock-screen truncation on iPhone SE / compact devices.
--  2) Body text stays strictly under 90-100 characters so 2 lines render cleanly without "..." cutoff.
--  3) Avoids excessive ALL-CAPS words to avoid OS spam/reputation penalties.
--  4) Emojis placed selectively and at the end of strings to avoid screen reader interruptions.
--  5) Uses a unified 'variant-daily-reminder' tag so each subsequent hour seamlessly replaces/updates
--     the previous reminder in the notification center instead of spamming 6 separate stacked banners.
--
-- Covers two player states with distinct, tailored copy:
-- 1) Mid-game ('playing'): Started earlier today but hasn't completed it.
-- 2) Not started (no record for today): Hasn't made their first guess yet.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.send_dynamic_evening_escalating_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now_wat TIMESTAMP := timezone('Africa/Lagos', now());
  v_hour_wat INT := EXTRACT(HOUR FROM v_now_wat)::int;
  v_today_date DATE := v_now_wat::date;
BEGIN
  -- Only execute between 18:00 and 23:00 WAT (6 PM to 11 PM)
  IF v_hour_wat < 18 OR v_hour_wat > 23 THEN
    RETURN;
  END IF;

  WITH candidate_users AS (
    SELECT DISTINCT 
      sub.user_id,
      p.username,
      sc.status AS play_status
    FROM public.push_subscriptions sub
    JOIN public.profiles p ON p.id = sub.user_id
    LEFT JOIN public.scores sc 
      ON sc.user_id = sub.user_id 
     AND sc.game_date = v_today_date
    -- Target users who haven't played AT ALL or have NOT completed (status = 'playing')
    -- Excludes completed games ('won', 'lost')
    WHERE (sc.id IS NULL OR sc.status = 'playing')
      -- Throttling guard: don't send if a notification of this type was already sent in the last 45 minutes
      AND NOT EXISTS (
        SELECT 1 
        FROM public.notifications n
        WHERE n.user_id = sub.user_id
          AND n.created_at >= (NOW() - INTERVAL '45 minutes')
          AND (n.data->>'type') = 'evening_escalating_push'
      )
  ),
  message_pool AS (
    SELECT 
      cu.user_id,
      cu.username,
      cu.play_status,
      CASE 
        -- ====================================================================
        -- BRANCH A: IN-PROGRESS / UNFINISHED ('playing')
        -- (Titles <= 38 chars, Body <= 100 chars)
        -- ====================================================================
        WHEN cu.play_status = 'playing' THEN
          CASE v_hour_wat
            -- 18:00 WAT (6 PM)
            WHEN 18 THEN (
              ARRAY[
                ARRAY['Finish what you started! 🏁', 'You began today''s puzzle earlier. Jump back in and seal the win!'],
                ARRAY['Halfway there! 🔍', 'Your board is waiting. Take 60 seconds to lock in the final guess!'],
                ARRAY['Unfinished business 📝', 'Don''t leave today''s puzzle on pause. Finish it before dinner!'],
                ARRAY['You got this! 💡', 'You already started today''s word. Come back and grab that victory!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 19:00 WAT (7 PM)
            WHEN 19 THEN (
              ARRAY[
                ARRAY['Don''t abandon your board! 🧩', 'Your guesses are saved. Just a couple more tries to crack the word!'],
                ARRAY['Dinner''s over, time to finish! 🍽️', 'You started earlier today. Complete it before the evening slips away!'],
                ARRAY['Victory is so close! 🎯', 'You already have clues on the board. Jump in and solve it now!'],
                ARRAY['One more guess? 🤔', 'You left your puzzle hanging. Come back and wrap up today''s game!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 20:00 WAT (8 PM)
            WHEN 20 THEN (
              ARRAY[
                ARRAY['Your puzzle is waiting 🧊', 'You started earlier today! 4 hours till midnight to finish it.'],
                ARRAY['Leaving us hanging? 🥺', 'You''re in the middle of today''s game. Don''t let it expire uncompleted!'],
                ARRAY['Cross the finish line! 🏃', 'A few guesses already placed. Come back and claim your points!'],
                ARRAY['Your streak needs this finish! 🔥', 'Unfinished games don''t count as wins. Finish up before the clock runs out!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 21:00 WAT (9 PM)
            WHEN 21 THEN (
              ARRAY[
                ARRAY['3 hours left to finish! ⏳', 'You already started today! Don''t take an automatic loss at midnight.'],
                ARRAY['We see your board waiting... 🦉', 'You did the hard part already. Just put in the winning guess!'],
                ARRAY['Finish line in sight! 🚨', 'Don''t let an unfinished game ruin your weekly leaderboard rank.'],
                ARRAY['Your board misses you 💔', 'You started today''s puzzle. 180 seconds is all you need to close it out!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 22:00 WAT (10 PM)
            WHEN 22 THEN (
              ARRAY[
                ARRAY['2 hours left to finish! ⚠️', 'You started today''s game! If you don''t finish by midnight, it counts as a loss.'],
                ARRAY['Finish before sleep! 🛌', 'Your guesses are waiting. Complete today''s word right now!'],
                ARRAY['Due by midnight! ⏰', 'Your in-progress puzzle locks in 2 hours. Wrap it up before bed!'],
                ARRAY['So close to a win! ⚡', 'You''re halfway through today''s board. Finish it before it''s too late!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 23:00 WAT (11 PM) - ULTIMATE DESPERATION
            WHEN 23 THEN (
              ARRAY[
                ARRAY['Final hour: finish your game! 🚨', 'Your puzzle is open and unfinished! Finish before midnight or lose your score.'],
                ARRAY['One guess can save you! 💥', 'You already made guesses today. Don''t throw it all away in the final hour!'],
                ARRAY['Last chance to finish! 😱', '60 minutes left! Jump back in and finish today''s word right now.'],
                ARRAY['The final 60 minutes ⏰', 'Your in-progress game locks at midnight. Finish the word and keep your streak!']
              ]
            )[1 + floor(random() * 4)::int]
          END

        -- ====================================================================
        -- BRANCH B: NOT STARTED YET (no guesses today)
        -- (Titles <= 38 chars, Body <= 100 chars)
        -- ====================================================================
        ELSE
          CASE v_hour_wat
            -- 18:00 WAT (6 PM)
            WHEN 18 THEN (
              ARRAY[
                ARRAY['Wordle time? ☕', 'Work is wrapping up! Perfect time for a quick 3-minute brain teaser.'],
                ARRAY['A fresh word is waiting 👀', 'Don''t let today slip away. Jump in for today''s daily challenge!'],
                ARRAY['Knock knock! 🚪', 'Today''s secret word is waiting. Give it a guess before your evening begins!'],
                ARRAY['Evening warm-up 🧠', '3 minutes, 6 guesses, infinite bragging rights. Ready?']
              ]
            )[1 + floor(random() * 4)::int]

            -- 19:00 WAT (7 PM)
            WHEN 19 THEN (
              ARRAY[
                ARRAY['Your brain called 🧠', 'It misses the green tiles! Take a quick 3-minute break to solve today''s puzzle.'],
                ARRAY['Dinner break = Wordle break 🍽️', 'Feed your vocabulary before the evening disappears.'],
                ARRAY['Leaderboard is heating up 🔥', 'Players worldwide are solving today''s word and climbing past you!'],
                ARRAY['Just 180 seconds ⏱️', 'That''s all it takes to keep your mind sharp today. Ready?']
              ]
            )[1 + floor(random() * 4)::int]

            -- 20:00 WAT (8 PM)
            WHEN 20 THEN (
              ARRAY[
                ARRAY['Your streak is nervous 😬', '4 hours till midnight. Don''t leave your streak hanging!'],
                ARRAY['Hello? Are you there? 🥺', 'The keyboard tiles are getting cold and lonely without you.'],
                ARRAY['Quick solve before relaxing? 🛋️', 'You can crack today''s word in 2 minutes flat. We believe in you!'],
                ARRAY['Don''t surrender today ⚔️', 'A zero on the daily board hurts. Jump in and get that win!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 21:00 WAT (9 PM)
            WHEN 21 THEN (
              ARRAY[
                ARRAY['Words won''t guess themselves 🦉', '3 hours left! We are literally on our knees right now.'],
                ARRAY['We see you scrolling... 📱', 'Put down the feed for 2 minutes and solve today''s word!'],
                ARRAY['Don''t break our heart 💔', 'Your daily streak is having an existential crisis right now.'],
                ARRAY['3 hours till the buzzer ⏳', 'One round is all it takes to stay on the leaderboard!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 22:00 WAT (10 PM)
            WHEN 22 THEN (
              ARRAY[
                ARRAY['2 hours left! Code Red 🚨', 'Midnight is creeping in fast! Protect your streak before it resets.'],
                ARRAY['Solve it before bed! 🛌', 'Nothing sleeps better than the sweet peace of an all-green row.'],
                ARRAY['Final warning (almost) ⚠️', 'Tick tock! The midnight cutoff is closing in. Play now!'],
                ARRAY['Panic stations! ⚡', '2 hours until today''s word locks forever. Save yourself!']
              ]
            )[1 + floor(random() * 4)::int]

            -- 23:00 WAT (11 PM) - ULTIMATE DESPERATION
            WHEN 23 THEN (
              ARRAY[
                ARRAY['1 hour till midnight! 🚨', 'This is not a drill! Your streak dies in 60 minutes unless you solve today!'],
                ARRAY['It''s now or never! 😱', 'Last chance before today''s puzzle locks forever! Solve it right now.'],
                ARRAY['Don''t let it reset to zero! 💥', 'Literally one puzzle stands between you and heartbreak. Go go go!'],
                ARRAY['The final countdown ⏰', '60 minutes. 6 guesses. You can still save today. Do it now!']
              ]
            )[1 + floor(random() * 4)::int]
          END
      END AS chosen_msg
    FROM candidate_users cu
  )
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    mp.user_id,
    'SYSTEM',
    (mp.chosen_msg)[1],
    (mp.chosen_msg)[2],
    jsonb_build_object(
      'type', 'evening_escalating_push',
      'hour_wat', v_hour_wat,
      'play_status', COALESCE(mp.play_status, 'not_started'),
      'tag', 'variant-daily-reminder',
      'url', '/'
    )
  FROM message_pool mp
  WHERE mp.chosen_msg IS NOT NULL;
END;
$$;

-- Unschedule if already registered, then schedule hourly during the 18:00 - 23:00 WAT window.
-- Note: WAT is UTC+1, so 18:00-23:00 WAT corresponds to 17:00-22:00 UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evening-escalating-reminders') THEN
    PERFORM cron.unschedule('evening-escalating-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'evening-escalating-reminders',
  '0 17-22 * * *',
  $$ SELECT public.send_dynamic_evening_escalating_push(); $$
);
