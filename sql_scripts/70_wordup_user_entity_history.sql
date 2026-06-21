-- 70_wordup_user_entity_history.sql

-- 1. Create wordup_user_entity_history table
CREATE TABLE IF NOT EXISTS public.wordup_user_entity_history (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES public.wordup_entities(id) ON DELETE CASCADE,
    occurrences INT DEFAULT 1 NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, entity_id)
);

-- 2. Configure RLS
ALTER TABLE public.wordup_user_entity_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read their own history"
ON public.wordup_user_entity_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert/update their own history"
ON public.wordup_user_entity_history FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Create get_wordup_entities_v2 RPC function
CREATE OR REPLACE FUNCTION public.get_wordup_entities_v2(
  p_category VARCHAR,
  p_user_ids UUID[],
  p_limit_per_type INT DEFAULT 40
)
RETURNS SETOF public.wordup_entities AS $$
DECLARE
  v_types VARCHAR[];
BEGIN
  -- 1. Determine types based on p_category
  IF p_category = 'english_language' THEN
    SELECT COALESCE(array_agg(DISTINCT type), ARRAY[]::VARCHAR[])
    INTO v_types
    FROM public.wordup_entities
    WHERE type LIKE 'english_%';
  ELSIF p_category = 'maths' THEN
    v_types := ARRAY['math_fundamentals'];
  ELSE
    v_types := ARRAY[p_category];
  END IF;

  -- 2. Query and return entities
  RETURN QUERY
  WITH ranked_entities AS (
    SELECT 
      e.*,
      ROW_NUMBER() OVER (
        PARTITION BY e.type 
        ORDER BY COALESCE(h.total_occurrences, 0) ASC, random()
      ) as rank_in_type
    FROM public.wordup_entities e
    LEFT JOIN (
      SELECT entity_id, SUM(occurrences)::INT as total_occurrences
      FROM public.wordup_user_entity_history
      WHERE user_id = ANY(p_user_ids)
      GROUP BY entity_id
    ) h ON e.id = h.entity_id
    WHERE e.type = ANY(v_types)
  )
  SELECT 
    id,
    type,
    label,
    metadata,
    difficulty,
    tags,
    created_at
  FROM ranked_entities
  WHERE rank_in_type <= p_limit_per_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create record_user_entities_seen RPC function
CREATE OR REPLACE FUNCTION public.record_user_entities_seen(
  p_user_ids UUID[],
  p_entity_ids UUID[]
)
RETURNS VOID AS $$
BEGIN
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_entity_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.wordup_user_entity_history (user_id, entity_id, occurrences, last_seen_at)
  SELECT u, e, 1, NOW()
  FROM unnest(p_user_ids) u
  CROSS JOIN unnest(p_entity_ids) e
  ON CONFLICT (user_id, entity_id)
  DO UPDATE SET 
    occurrences = public.wordup_user_entity_history.occurrences + 1,
    last_seen_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
