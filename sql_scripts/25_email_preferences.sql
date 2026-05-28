-- 25_email_preferences.sql
-- Create table and functions to manage user email notification preferences and recipient querying

-- 1. Create email_preferences table
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  receive_emails BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Define RLS Policies
DROP POLICY IF EXISTS "Allow select by owner" ON public.email_preferences;
CREATE POLICY "Allow select by owner" ON public.email_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow insert by owner" ON public.email_preferences;
CREATE POLICY "Allow insert by owner" ON public.email_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow update by owner" ON public.email_preferences;
CREATE POLICY "Allow update by owner" ON public.email_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 3. Create unsubscribe_user function (SECURITY DEFINER to bypass RLS for token-based email unsubscribe links)
CREATE OR REPLACE FUNCTION public.unsubscribe_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id, receive_emails, updated_at)
  VALUES (target_user_id, false, timezone('utc', now()))
  ON CONFLICT (user_id) DO UPDATE
  SET receive_emails = false, updated_at = timezone('utc', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for public unsubscribe RPC execution
GRANT EXECUTE ON FUNCTION public.unsubscribe_user(UUID) TO anon, authenticated;


-- 4. Helper function to find players who skipped yesterday (D-1) but played the day before (D-2)
CREATE OR REPLACE FUNCTION public.get_skipped_day_recipients()
RETURNS TABLE (user_id UUID, username TEXT, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  LEFT JOIN public.email_preferences ep ON p.id = ep.user_id
  WHERE COALESCE(ep.receive_emails, true) = true
    -- Played D-2
    AND EXISTS (
      SELECT 1 FROM public.scores s
      WHERE s.user_id = p.id
        AND s.game_date::date = (timezone('Africa/Lagos', now())::date - 2)
    )
    -- Did not play D-1
    AND NOT EXISTS (
      SELECT 1 FROM public.scores s
      WHERE s.user_id = p.id
        AND s.game_date::date = (timezone('Africa/Lagos', now())::date - 1)
    )
    -- Did not play today (D) yet (just in case)
    AND NOT EXISTS (
      SELECT 1 FROM public.scores s
      WHERE s.user_id = p.id
        AND s.game_date::date = timezone('Africa/Lagos', now())::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Helper function to find players who have not played in the last 3 days
CREATE OR REPLACE FUNCTION public.get_three_day_inactive_recipients()
RETURNS TABLE (user_id UUID, username TEXT, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  LEFT JOIN public.email_preferences ep ON p.id = ep.user_id
  WHERE COALESCE(ep.receive_emails, true) = true
    -- User registered at least 3 days ago (don't spam brand new registrations)
    AND u.created_at <= (now() - interval '3 days')
    -- No games played in the last 3 days (Friday, Saturday, Sunday if run on Monday)
    AND NOT EXISTS (
      SELECT 1 FROM public.scores s
      WHERE s.user_id = p.id
        AND s.game_date::date >= (timezone('Africa/Lagos', now())::date - 3)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Helper function to find players with an active streak > 1 who haven't played by evening today
CREATE OR REPLACE FUNCTION public.get_streak_warning_recipients()
RETURNS TABLE (user_id UUID, username TEXT, email TEXT, current_streak INT) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE streak_calc AS (
    -- Anchor: Won yesterday (D-1)
    SELECT s.user_id, s.game_date::date AS last_date, 1 AS streak
    FROM public.scores s
    WHERE s.status = 'won' AND s.game_date::date = (timezone('Africa/Lagos', now())::date - 1)
    
    UNION ALL
    
    -- Recursive: Won consecutive preceding days
    SELECT s.user_id, s.game_date::date, sc.streak + 1
    FROM public.scores s
    JOIN streak_calc sc ON s.user_id = sc.user_id AND s.game_date::date = sc.last_date - 1
    WHERE s.status = 'won'
  ),
  active_streaks AS (
    SELECT sc.user_id, MAX(sc.streak) as val
    FROM streak_calc sc
    GROUP BY sc.user_id
  )
  SELECT p.id, p.username, u.email::text, ast.val::int
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  JOIN active_streaks ast ON p.id = ast.user_id
  LEFT JOIN public.email_preferences ep ON p.id = ep.user_id
  WHERE COALESCE(ep.receive_emails, true) = true
    AND ast.val > 1
    -- Has not played today yet
    AND NOT EXISTS (
      SELECT 1 FROM public.scores s
      WHERE s.user_id = p.id
        AND s.game_date::date = timezone('Africa/Lagos', now())::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Helper function to get the weekly leaderboard rankings for the previous week
DROP FUNCTION IF EXISTS public.get_weekly_report_leaderboard();
CREATE OR REPLACE FUNCTION public.get_weekly_report_leaderboard()
RETURNS TABLE (username TEXT, avatar_url TEXT, total_points INT, days_active INT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
      p.username,
      p.avatar_url,
      COALESCE(SUM(s.skill_score), 0)::int AS total_points,
      COUNT(DISTINCT s.game_date)::int AS days_active
  FROM public.scores s
  JOIN public.profiles p ON s.user_id = p.id
  -- Previous week: Monday to Sunday
  WHERE s.game_date::date >= (timezone('Africa/Lagos', now())::date - EXTRACT(ISODOW FROM timezone('Africa/Lagos', now()))::integer - 6)::date
    AND s.game_date::date <= (timezone('Africa/Lagos', now())::date - EXTRACT(ISODOW FROM timezone('Africa/Lagos', now()))::integer)::date
  GROUP BY p.username, p.avatar_url
  ORDER BY total_points DESC, days_active DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Helper function to get recipients of the weekly report (everyone who hasn't opted out)
CREATE OR REPLACE FUNCTION public.get_weekly_report_recipients()
RETURNS TABLE (user_id UUID, username TEXT, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  LEFT JOIN public.email_preferences ep ON p.id = ep.user_id
  WHERE COALESCE(ep.receive_emails, true) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Helper function to find a profile by email (useful for test operations)
CREATE OR REPLACE FUNCTION public.get_profile_by_email(email_addr TEXT)
RETURNS TABLE (id UUID, username TEXT, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = email_addr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

