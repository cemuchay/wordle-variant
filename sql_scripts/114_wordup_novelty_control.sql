-- 114_wordup_novelty_control.sql
-- Enhances get_wordup_entities_v2 to support dual-bucket fetching, seen-count tracking,
-- and excluding previously seen entities for freshness.

CREATE OR REPLACE FUNCTION public.get_wordup_entities_v2(
    p_category VARCHAR,
    p_user_ids UUID[],
    p_limit_per_type INT DEFAULT 40,
    p_difficulty_max INT DEFAULT NULL,
    p_difficulty_min INT DEFAULT NULL,
    p_exclude_seen BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    type VARCHAR,
    label VARCHAR,
    metadata JSONB,
    difficulty INT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE,
    total_seen INT
) AS $$
DECLARE
    v_topic_ids UUID[];
BEGIN
    -- Determine topic_ids based on p_category
    IF p_category = 'english_language' THEN
        SELECT COALESCE(array_agg(t.id), ARRAY[]::UUID[])
        INTO v_topic_ids
        FROM public.topics t
        WHERE t.slug LIKE 'english_%' OR t.slug = 'english_language';
    ELSIF p_category = 'maths' THEN
        SELECT COALESCE(array_agg(t.id), ARRAY[]::UUID[])
        INTO v_topic_ids
        FROM public.topics t
        WHERE t.slug = 'math_fundamentals' OR t.slug = 'maths';
    ELSIF p_category IN ('element_arena', 'periodic-table', 'periodic_table', 'chemistry') THEN
        SELECT COALESCE(array_agg(t.id), ARRAY[]::UUID[])
        INTO v_topic_ids
        FROM public.topics t
        WHERE t.slug = 'chemistry';
    ELSE
        SELECT COALESCE(array_agg(t.id), ARRAY[]::UUID[])
        INTO v_topic_ids
        FROM public.topics t
        WHERE t.slug = p_category;
    END IF;

    -- Query and return reconstructed entities with total_seen
    RETURN QUERY
    WITH ranked_entities AS (
        SELECT
            e.id,
            p_category as type,
            e.label,
            COALESCE(
                (
                    SELECT jsonb_object_agg(key, val)
                    FROM (
                        SELECT p.name as key, f.value as val
                        FROM public.facts f
                        JOIN public.predicates p ON f.predicate_id = p.id
                        WHERE f.subject_id = e.id
                        UNION ALL
                        SELECT '_entity_type'::varchar as key, et.name::text as val
                        FROM public.entity_types et
                        WHERE et.id = e.type_id
                        UNION ALL
                        SELECT 'image'::varchar as key, max(a.file) as val
                        FROM public.assets a
                        WHERE a.entity_id = e.id AND a.asset_type = 'image'
                        GROUP BY a.entity_id
                        HAVING count(a.id) = 1
                        UNION ALL
                        SELECT 'images'::varchar as key, jsonb_agg(a.file)::text as val
                        FROM public.assets a
                        WHERE a.entity_id = e.id AND a.asset_type = 'image'
                        GROUP BY a.entity_id
                        HAVING count(a.id) > 1
                    ) sub
                    WHERE val IS NOT NULL
                ),
                '{}'::jsonb
            ) as metadata,
            e.difficulty,
            e.tags,
            e.created_at,
            COALESCE(h.total_occurrences, 0) as total_seen,
            ROW_NUMBER() OVER (
                PARTITION BY e.type_id
                ORDER BY COALESCE(h.total_occurrences, 0) ASC, random()
            ) as rank_in_type
        FROM public.entities e
        JOIN public.topics t ON e.topic_id = t.id
        LEFT JOIN (
            SELECT entity_id, SUM(occurrences)::INT as total_occurrences
            FROM public.wordup_user_entity_history
            WHERE user_id = ANY(p_user_ids)
            GROUP BY entity_id
        ) h ON e.id = h.entity_id
        WHERE e.topic_id = ANY(v_topic_ids)
            AND (p_difficulty_max IS NULL OR e.difficulty <= p_difficulty_max)
            AND (p_difficulty_min IS NULL OR e.difficulty >= p_difficulty_min)
            AND (NOT p_exclude_seen OR h.total_occurrences IS NULL)
    )
    SELECT
        re.id,
        re.type,
        re.label,
        re.metadata,
        re.difficulty,
        re.tags,
        re.created_at,
        re.total_seen
    FROM ranked_entities re
    WHERE re.rank_in_type <= p_limit_per_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
