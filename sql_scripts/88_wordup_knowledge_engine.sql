-- 88_wordup_knowledge_engine.sql

-- 1. Drop existing tables and dependants
DROP TABLE IF EXISTS public.wordup_user_entity_history CASCADE;
DROP TABLE IF EXISTS public.wordup_entities CASCADE;

-- 2. Create topics table
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create entity_types table
CREATE TABLE IF NOT EXISTS public.entity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (topic_id, name)
);

-- 4. Create entities table
CREATE TABLE IF NOT EXISTS public.entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    type_id UUID REFERENCES public.entity_types(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create predicates table
CREATE TABLE IF NOT EXISTS public.predicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value_type VARCHAR(50) NOT NULL CHECK (value_type IN ('entity', 'year', 'integer', 'text', 'decimal', 'enum')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (topic_id, name)
);

-- 6. Create facts table
CREATE TABLE IF NOT EXISTS public.facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    predicate_id UUID REFERENCES public.predicates(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (subject_id, predicate_id, value)
);

-- 7. Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL,
    file VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create question_templates table
CREATE TABLE IF NOT EXISTS public.question_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    answer_key VARCHAR DEFAULT NULL,
    required_keys VARCHAR[] NOT NULL,
    prompts TEXT[] NOT NULL,
    explanations TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Recreate wordup_user_entity_history table referencing entities(id)
CREATE TABLE IF NOT EXISTS public.wordup_user_entity_history (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    occurrences INT DEFAULT 1 NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, entity_id)
);

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordup_user_entity_history ENABLE ROW LEVEL SECURITY;

-- 11. Create basic SELECT policies for everyone (public)
CREATE POLICY "Allow public read access to topics" ON public.topics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read access to entity_types" ON public.entity_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read access to entities" ON public.entities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read access to predicates" ON public.predicates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read access to facts" ON public.facts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read access to assets" ON public.assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read access to question_templates" ON public.question_templates FOR SELECT TO anon, authenticated USING (true);

-- 12. Create policies for wordup_user_entity_history
CREATE POLICY "Allow authenticated users to read their own history" ON public.wordup_user_entity_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow authenticated users to insert/update their own history" ON public.wordup_user_entity_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 13. Create get_wordup_entities_v2 RPC function
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
  -- 1. Determine topic_ids based on p_category
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

  -- 2. Query and return reconstructed entities
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

-- 14. Create record_user_entities_seen RPC function
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

-- 15. Seed baseline Topics
INSERT INTO public.topics (id, slug, name) VALUES
('b2ce8a30-01d7-46c5-8422-79fc74d47101', 'football', 'Football'),
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'chemistry', 'Chemistry')
ON CONFLICT (slug) DO NOTHING;

-- 16. Seed Entity Types
INSERT INTO public.entity_types (id, topic_id, name) VALUES
('c2ce8a30-02d7-46c5-8422-79fc74d47201', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'Club'),
('c2ce8a30-02d7-46c5-8422-79fc74d47202', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'Player'),
('c2ce8a30-02d7-46c5-8422-79fc74d47203', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'Competition'),
('c2ce8a30-02d7-46c5-8422-79fc74d47204', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'Stadium')
ON CONFLICT (topic_id, name) DO NOTHING;

-- 17. Seed Predicates
INSERT INTO public.predicates (id, topic_id, name, value_type) VALUES
('d2ce8a30-03d7-46c5-8422-79fc74d47301', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'stadium', 'entity'),
('d2ce8a30-03d7-46c5-8422-79fc74d47302', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'founded', 'year'),
('d2ce8a30-03d7-46c5-8422-79fc74d47303', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'country', 'entity')
ON CONFLICT (topic_id, name) DO NOTHING;

-- 18. Seed Entities
INSERT INTO public.entities (id, topic_id, type_id, label, difficulty, tags) VALUES
('e2ce8a30-04d7-46c5-8422-79fc74d47401', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'c2ce8a30-02d7-46c5-8422-79fc74d47201', 'Liverpool', 1, ARRAY['club', 'england']),
('e2ce8a30-04d7-46c5-8422-79fc74d47402', 'b2ce8a30-01d7-46c5-8422-79fc74d47101', 'c2ce8a30-02d7-46c5-8422-79fc74d47202', 'Lionel Messi', 1, ARRAY['player', 'argentina'])
ON CONFLICT (id) DO NOTHING;

-- 19. Seed Facts
INSERT INTO public.facts (subject_id, predicate_id, value) VALUES
-- Liverpool facts
('e2ce8a30-04d7-46c5-8422-79fc74d47401', 'd2ce8a30-03d7-46c5-8422-79fc74d47301', 'Anfield'),
('e2ce8a30-04d7-46c5-8422-79fc74d47401', 'd2ce8a30-03d7-46c5-8422-79fc74d47303', 'England'),
('e2ce8a30-04d7-46c5-8422-79fc74d47401', 'd2ce8a30-03d7-46c5-8422-79fc74d47302', '1892')
ON CONFLICT DO NOTHING;

-- 20. Seed Assets
INSERT INTO public.assets (entity_id, asset_type, file) VALUES
('e2ce8a30-04d7-46c5-8422-79fc74d47401', 'logo', 'liverpool.svg'),
('e2ce8a30-04d7-46c5-8422-79fc74d47401', 'stadium_photo', 'anfield.webp')
ON CONFLICT DO NOTHING;

-- 21. Seed Question Templates
INSERT INTO public.question_templates (topic_id, answer_key, required_keys, prompts, explanations) VALUES
-- Football Templates
('b2ce8a30-01d7-46c5-8422-79fc74d47101', 'stadium', ARRAY['stadium'], ARRAY['Which stadium is home to {club}?'], ARRAY['{label} plays their home matches at {stadium}.'])
ON CONFLICT DO NOTHING;
