-- 89_periodic_entities.sql

-- 1. Upgrade periodic-table topic to chemistry slug
INSERT INTO public.topics (id, slug, name) 
VALUES ('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'chemistry', 'Chemistry')
ON CONFLICT (id) DO UPDATE SET slug = 'chemistry', name = 'Chemistry';

-- 2. Clean up element_arena topic (cascade deletes its entities, facts, templates)
DELETE FROM public.topics WHERE slug = 'element_arena';

-- 3. Clean up old elements seeded in 88 under chemistry topic
DELETE FROM public.entities WHERE id IN ('e2ce8a30-04d7-46c5-8422-79fc74d47403', 'e2ce8a30-04d7-46c5-8422-79fc74d47404');

-- 4. Clean up old question templates seeded in 88 under chemistry topic
DELETE FROM public.question_templates WHERE topic_id = 'b2ce8a30-01d7-46c5-8422-79fc74d47102';

-- 5. Clean up old predicates seeded in 88 under chemistry topic to avoid ID conflicts
DELETE FROM public.predicates WHERE topic_id = 'b2ce8a30-01d7-46c5-8422-79fc74d47102';

-- 6. Clean up old entity types seeded in 88 under chemistry topic
DELETE FROM public.entity_types WHERE topic_id = 'b2ce8a30-01d7-46c5-8422-79fc74d47102';

-- 7. Seed Topic Type for Chemistry Element
INSERT INTO public.entity_types (id, topic_id, name) VALUES
('c2ce8a30-02d7-46c5-8422-79fc74d47205', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'Element')
ON CONFLICT (topic_id, name) DO NOTHING;

-- 2. Seed Expanded Chemistry Predicates
INSERT INTO public.predicates (id, topic_id, name, value_type) VALUES
('d2ce8a30-03d7-46c5-8422-79fc74d47304', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'atomic_number', 'integer'),
('d2ce8a30-03d7-46c5-8422-79fc74d47305', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'symbol', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47306', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'atomic_mass', 'decimal'),
('d2ce8a30-03d7-46c5-8422-79fc74d47307', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'state', 'enum'),
('d2ce8a30-03d7-46c5-8422-79fc74d47308', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'group', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47309', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'period', 'integer'),
('d2ce8a30-03d7-46c5-8422-79fc74d47310', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'category', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47311', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'color', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47312', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'density', 'decimal'),
('d2ce8a30-03d7-46c5-8422-79fc74d47313', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'melting_point', 'decimal'),
('d2ce8a30-03d7-46c5-8422-79fc74d47314', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'boiling_point', 'decimal'),
('d2ce8a30-03d7-46c5-8422-79fc74d47315', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'electronegativity', 'decimal'),
('d2ce8a30-03d7-46c5-8422-79fc74d47316', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'electron_configuration', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47317', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'discovered_by', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47318', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'discovery_year', 'integer'),
('d2ce8a30-03d7-46c5-8422-79fc74d47319', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'common_use', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47320', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'radioactive', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47321', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'natural', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47322', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'abundance', 'text')
ON CONFLICT (topic_id, name) DO NOTHING;

-- 3. Seed 25 Element Entities
INSERT INTO public.entities (id, topic_id, type_id, label, difficulty, tags) VALUES
('f2ce8a30-05d7-46c5-8422-79fc74d47501', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Hydrogen', 1, ARRAY['element', 'gas', 'nonmetal']),
('f2ce8a30-05d7-46c5-8422-79fc74d47502', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Helium', 1, ARRAY['element', 'gas', 'noble-gas']),
('f2ce8a30-05d7-46c5-8422-79fc74d47503', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Lithium', 2, ARRAY['element', 'metal', 'alkali']),
('f2ce8a30-05d7-46c5-8422-79fc74d47504', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Beryllium', 3, ARRAY['element', 'metal', 'alkaline-earth']),
('f2ce8a30-05d7-46c5-8422-79fc74d47505', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Boron', 3, ARRAY['element', 'metalloid']),
('f2ce8a30-05d7-46c5-8422-79fc74d47506', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Carbon', 1, ARRAY['element', 'nonmetal', 'organic']),
('f2ce8a30-05d7-46c5-8422-79fc74d47507', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Nitrogen', 1, ARRAY['element', 'gas', 'nonmetal']),
('f2ce8a30-05d7-46c5-8422-79fc74d47508', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Oxygen', 1, ARRAY['element', 'gas', 'nonmetal']),
('f2ce8a30-05d7-46c5-8422-79fc74d47509', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Fluorine', 2, ARRAY['element', 'gas', 'halogen']),
('f2ce8a30-05d7-46c5-8422-79fc74d47510', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Neon', 2, ARRAY['element', 'gas', 'noble-gas']),
('f2ce8a30-05d7-46c5-8422-79fc74d47511', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Sodium', 2, ARRAY['element', 'metal', 'alkali']),
('f2ce8a30-05d7-46c5-8422-79fc74d47512', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Magnesium', 2, ARRAY['element', 'metal', 'alkaline-earth']),
('f2ce8a30-05d7-46c5-8422-79fc74d47513', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Aluminum', 2, ARRAY['element', 'metal', 'post-transition']),
('f2ce8a30-05d7-46c5-8422-79fc74d47514', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Silicon', 2, ARRAY['element', 'metalloid']),
('f2ce8a30-05d7-46c5-8422-79fc74d47515', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Phosphorus', 3, ARRAY['element', 'nonmetal']),
('f2ce8a30-05d7-46c5-8422-79fc74d47516', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Sulfur', 2, ARRAY['element', 'nonmetal']),
('f2ce8a30-05d7-46c5-8422-79fc74d47517', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Chlorine', 2, ARRAY['element', 'gas', 'halogen']),
('f2ce8a30-05d7-46c5-8422-79fc74d47518', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Argon', 3, ARRAY['element', 'gas', 'noble-gas']),
('f2ce8a30-05d7-46c5-8422-79fc74d47519', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Potassium', 3, ARRAY['element', 'metal', 'alkali']),
('f2ce8a30-05d7-46c5-8422-79fc74d47520', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Calcium', 2, ARRAY['element', 'metal', 'alkaline-earth']),
('f2ce8a30-05d7-46c5-8422-79fc74d47521', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Iron', 2, ARRAY['element', 'metal', 'transition']),
('f2ce8a30-05d7-46c5-8422-79fc74d47522', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Copper', 2, ARRAY['element', 'metal', 'transition']),
('f2ce8a30-05d7-46c5-8422-79fc74d47523', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Silver', 3, ARRAY['element', 'metal', 'precious', 'transition']),
('f2ce8a30-05d7-46c5-8422-79fc74d47524', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Gold', 3, ARRAY['element', 'metal', 'precious', 'transition']),
('f2ce8a30-05d7-46c5-8422-79fc74d47525', 'b2ce8a30-01d7-46c5-8422-79fc74d47102', 'c2ce8a30-02d7-46c5-8422-79fc74d47205', 'Uranium', 4, ARRAY['element', 'metal', 'actinide', 'radioactive'])
ON CONFLICT (id) DO NOTHING;
