-- 124_wordup_leaderboard_views.sql
-- Unified SQL View for WordUp Leaderboards (Global & Per-Category)
-- Integrates profile details, inactivity rating decay, and exact rank position calculation.

CREATE OR REPLACE VIEW public.wordup_unified_leaderboard_view AS
SELECT 
    p.id AS user_id,
    'global'::VARCHAR(50) AS category,
    pr.username,
    pr.avatar_url,
    p.games_played,
    p.games_won,
    p.games_lost,
    p.games_tied,
    p.xp,
    p.updated_at,
    CASE 
        WHEN p.games_played > 0 AND (NOW() - p.updated_at) >= INTERVAL '7 days' THEN
            GREATEST(600, p.rating - (FLOOR(EXTRACT(DAY FROM (NOW() - p.updated_at)) / 7) * 15)::INT)
        ELSE p.rating
    END AS rating,
    RANK() OVER (
        ORDER BY 
        (CASE 
            WHEN p.games_played > 0 AND (NOW() - p.updated_at) >= INTERVAL '7 days' THEN
                GREATEST(600, p.rating - (FLOOR(EXTRACT(DAY FROM (NOW() - p.updated_at)) / 7) * 15)::INT)
            ELSE p.rating
        END) DESC
    ) AS rank_position
FROM public.wordup_profiles p
LEFT JOIN public.profiles pr ON pr.id = p.id
WHERE p.games_played > 0

UNION ALL

SELECT 
    cp.user_id,
    cp.category,
    pr.username,
    pr.avatar_url,
    cp.games_played,
    cp.games_won,
    cp.games_lost,
    cp.games_tied,
    cp.xp,
    cp.updated_at,
    CASE 
        WHEN cp.games_played > 0 AND (NOW() - cp.updated_at) >= INTERVAL '7 days' THEN
            GREATEST(600, cp.rating - (FLOOR(EXTRACT(DAY FROM (NOW() - cp.updated_at)) / 7) * 15)::INT)
        ELSE cp.rating
    END AS rating,
    RANK() OVER (
        PARTITION BY cp.category
        ORDER BY 
        (CASE 
            WHEN cp.games_played > 0 AND (NOW() - cp.updated_at) >= INTERVAL '7 days' THEN
                GREATEST(600, cp.rating - (FLOOR(EXTRACT(DAY FROM (NOW() - cp.updated_at)) / 7) * 15)::INT)
            ELSE cp.rating
        END) DESC
    ) AS rank_position
FROM public.wordup_category_profiles cp
LEFT JOIN public.profiles pr ON pr.id = cp.user_id
WHERE cp.games_played > 0;

-- Permissions
GRANT SELECT ON public.wordup_unified_leaderboard_view TO anon, authenticated;
