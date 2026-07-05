-- 93_wordup_chemistry_engine_updates.sql

-- 1. Alter question_templates table to add answer_key column
ALTER TABLE public.question_templates 
ADD COLUMN IF NOT EXISTS answer_key VARCHAR DEFAULT NULL;

-- 2. Update get_wordup_entities_v2 RPC function to support chemistry collapsing & dynamic type mapping
CREATE OR REPLACE FUNCTION public.get_wordup_entities_v2(
  p_category VARCHAR,
  p_user_ids UUID[],
  p_limit_per_type INT DEFAULT 40
)
RETURNS TABLE (
  id UUID,
  type VARCHAR,
  label VARCHAR,
  metadata JSONB,
  difficulty INT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE
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

  -- Query and return reconstructed entities
  RETURN QUERY
  WITH ranked_entities AS (
    SELECT 
      e.id,
      p_category as type, -- Map back to requested category slug for client compatibility
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
  )
  SELECT 
    re.id,
    re.type,
    re.label,
    re.metadata,
    re.difficulty,
    re.tags,
    re.created_at
  FROM ranked_entities re
  WHERE re.rank_in_type <= p_limit_per_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
