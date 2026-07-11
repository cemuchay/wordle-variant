-- 106_seed_flag_bearer.sql
-- Seed script for Flags (flag_bearer) category in the new knowledge engine schema

-- 1. Insert Topic
INSERT INTO public.topics (slug, name) 
VALUES ('flag_bearer', 'Flags') 
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Entity Type
INSERT INTO public.entity_types (topic_id, name)
VALUES ((SELECT id FROM public.topics WHERE slug = 'flag_bearer'), 'Country')
ON CONFLICT (topic_id, name) DO NOTHING;

-- 3. Clean up any existing entities under this topic to allow safe re-runs
DELETE FROM public.entities 
WHERE topic_id = (SELECT id FROM public.topics WHERE slug = 'flag_bearer');

-- 4. Bulk Insert Entities and Facts in a single query using CTE
WITH input_data (label, metadata, difficulty, tags) AS (
  VALUES
    -- Easy Countries (Difficulty 1-2)
    ('Nigeria', '{
      "flag_code": "ng", "colors": "Green, White", "continent": "Africa", "capital": "Abuja", "primary_language": "English", "currency": "Naira",
      "population_rank": 6, "area_rank": 32, "driving_side": "right", "un_member": true, "landlocked": false,
      "region": "West Africa", "subregion": "Western Africa", "demonym": "Nigerian", "independence_year": 1960, "emoji": "🇳🇬",
      "shape": "rectangle", "has_stars": false, "has_cross": false, "has_moon": false, "has_sun": false, "has_coat_of_arms": false,
      "stripe_orientation": "vertical", "symbol": "none"
    }'::jsonb, 1, ARRAY['africa', 'easy'])
),
inserted_entities AS (
  INSERT INTO public.entities (topic_id, type_id, label, difficulty, tags)
  SELECT 
      (SELECT id FROM public.topics WHERE slug = 'flag_bearer'),
      (SELECT id FROM public.entity_types WHERE name = 'Country' AND topic_id = (SELECT id FROM public.topics WHERE slug = 'flag_bearer')),
      label,
      difficulty,
      tags
  FROM input_data
  RETURNING id, label
),
register_predicates AS (
  INSERT INTO public.predicates (topic_id, name, value_type)
  SELECT DISTINCT
      (SELECT id FROM public.topics WHERE slug = 'flag_bearer'),
      key,
      'text'
  FROM input_data,
  LATERAL jsonb_each_text(metadata)
  ON CONFLICT (topic_id, name) DO NOTHING
)
INSERT INTO public.facts (subject_id, predicate_id, value)
SELECT 
    e.id,
    p.id,
    kv.value
FROM input_data t
JOIN inserted_entities e ON e.label = t.label
CROSS JOIN LATERAL jsonb_each_text(t.metadata) kv
JOIN public.predicates p ON p.name = kv.key AND p.topic_id = (SELECT id FROM public.topics WHERE slug = 'flag_bearer')
ON CONFLICT DO NOTHING;
