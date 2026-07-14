-- 110_bible_entities_seed.sql
-- Seed data for Bible procedural questions in the knowledge engine schema.
-- Each entity supplies metadata keys that match the bible_* templates in templates.ts.
-- Requires: 88_wordup_knowledge_engine.sql

-- ═══════════════════════════════════════════════════════════════
-- 1. Register the Bible topic
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.topics (slug, name) 
VALUES ('bible', 'Bible') 
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. Register entity types
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.entity_types (topic_id, name)
SELECT id, 'Person' FROM public.topics WHERE slug = 'bible'
UNION ALL
SELECT id, 'Book' FROM public.topics WHERE slug = 'bible'
UNION ALL
SELECT id, 'Location' FROM public.topics WHERE slug = 'bible'
UNION ALL
SELECT id, 'NumberFact' FROM public.topics WHERE slug = 'bible'
ON CONFLICT (topic_id, name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. Clean up existing bible entities for safe re-runs
-- ═══════════════════════════════════════════════════════════════
DELETE FROM public.entities 
WHERE topic_id = (SELECT id FROM public.topics WHERE slug = 'bible');

-- ═══════════════════════════════════════════════════════════════════
-- 4. PEOPLE (Old Testament + New Testament)
-- ═══════════════════════════════════════════════════════════════════
WITH input_data (label, metadata, difficulty, tags) AS (
  VALUES
    ('Adam', '{
      "action":"was the first man created by God",
      "relation":"husband of",
      "relative":"Eve",
      "pair_partner":"Eve"
    }'::jsonb, 1, ARRAY['old-testament', 'genesis', 'patriarch']),

    ('Eve', '{
      "action":"was the first woman created by God",
      "pair_partner":"Adam"
    }'::jsonb, 1, ARRAY['old-testament', 'genesis']),

    ('Noah', '{
      "action":"built the ark to survive the great flood",
      "miracle":"surviving the great flood with his family",
      "animal_context":"sent out a dove from the ark to find dry land"
    }'::jsonb, 1, ARRAY['old-testament', 'genesis']),

    ('Abraham', '{
      "quote":"Here I am, send me",
      "action":"was called by God to be the father of many nations",
      "relation":"father of",
      "relative":"Isaac",
      "pair_partner":"Sarah",
      "miracle":"fathering Isaac at 100 years old"
    }'::jsonb, 1, ARRAY['old-testament', 'patriarch']),

    ('Sarah', '{
      "action":"was the wife of Abraham and mother of Isaac",
      "pair_partner":"Abraham"
    }'::jsonb, 2, ARRAY['old-testament', 'matriarch']),

    ('Isaac', '{
      "action":"was the promised son of Abraham",
      "relation":"son of",
      "relative":"Abraham",
      "pair_partner":"Rebekah"
    }'::jsonb, 2, ARRAY['old-testament', 'patriarch']),

    ('Rebekah', '{
      "action":"became the wife of Isaac at the well",
      "pair_partner":"Isaac"
    }'::jsonb, 3, ARRAY['old-testament', 'matriarch']),

    ('Jacob', '{
      "action":"wrestled with God and was renamed Israel",
      "relation":"father of",
      "relative":"the twelve tribes of Israel",
      "pair_partner":"Esau",
      "object_context":"saw a ladder in a dream reaching to heaven"
    }'::jsonb, 2, ARRAY['old-testament', 'patriarch']),

    ('Esau', '{
      "action":"sold his birthright to Jacob for a bowl of stew",
      "pair_partner":"Jacob"
    }'::jsonb, 3, ARRAY['old-testament']),

    ('Joseph', '{
      "action":"was sold into slavery by his brothers and became governor of Egypt",
      "miracle":"interpreting Pharaoh''s dreams",
      "object_context":"wore a coat of many colors given by his father"
    }'::jsonb, 2, ARRAY['old-testament', 'genesis']),

    ('Moses', '{
      "quote":"Let my people go",
      "action":"led Israel out of Egypt",
      "miracle":"parting the Red Sea",
      "object_context":"used a staff to part the Red Sea",
      "pair_partner":"Aaron"
    }'::jsonb, 1, ARRAY['old-testament', 'exodus', 'prophet']),

    ('Aaron', '{
      "action":"served as the first high priest of Israel",
      "relation":"brother of",
      "relative":"Moses",
      "pair_partner":"Moses"
    }'::jsonb, 2, ARRAY['old-testament', 'exodus']),

    ('Joshua', '{
      "action":"led the Israelites into the Promised Land",
      "miracle":"making the walls of Jericho fall down",
      "predecessor":"Moses",
      "succession_role":"leader of Israel"
    }'::jsonb, 2, ARRAY['old-testament', 'joshua']),

    ('Samson', '{
      "action":"was a judge of Israel with supernatural strength",
      "pair_partner":"Delilah",
      "animal_context":"tied torches to the tails of foxes to burn Philistine fields"
    }'::jsonb, 3, ARRAY['old-testament', 'judges']),

    ('Samuel', '{
      "action":"was the last judge of Israel and anointed its first kings"
    }'::jsonb, 2, ARRAY['old-testament', 'prophet']),

    ('Saul', '{
      "action":"was the first king of Israel"
    }'::jsonb, 2, ARRAY['old-testament', 'king']),

    ('David', '{
      "quote":"The Lord is my shepherd",
      "action":"defeated Goliath and became king of Israel",
      "object_context":"used a sling and a stone to defeat Goliath",
      "pair_partner":"Goliath",
      "predecessor":"Saul",
      "succession_role":"king of Israel"
    }'::jsonb, 1, ARRAY['old-testament', 'king']),

    ('Solomon', '{
      "quote":"The fear of the Lord is the beginning of wisdom",
      "action":"built the first Temple in Jerusalem",
      "predecessor":"David",
      "succession_role":"king of Israel"
    }'::jsonb, 2, ARRAY['old-testament', 'king']),

    ('Elijah', '{
      "action":"was a prophet who challenged the prophets of Baal",
      "miracle":"calling down fire from heaven on Mount Carmel",
      "animal_context":"was fed by ravens in the wilderness"
    }'::jsonb, 2, ARRAY['old-testament', 'prophet']),

    ('Elisha', '{
      "action":"succeeded Elijah as a prophet of Israel",
      "miracle":"healing Naaman of leprosy",
      "predecessor":"Elijah",
      "succession_role":"prophet of Israel"
    }'::jsonb, 3, ARRAY['old-testament', 'prophet']),

    ('Jonah', '{
      "action":"was swallowed by a great fish",
      "miracle":"surviving three days inside a great fish",
      "animal_context":"was swallowed by a great fish"
    }'::jsonb, 2, ARRAY['old-testament', 'prophet']),

    ('Daniel', '{
      "action":"was thrown into a den of lions for praying to God",
      "miracle":"surviving a night in the lions'' den",
      "animal_context":"was thrown into a den of lions"
    }'::jsonb, 2, ARRAY['old-testament', 'prophet']),

    ('Esther', '{
      "action":"saved the Jewish people from destruction in Persia",
      "pair_partner":"Mordecai"
    }'::jsonb, 2, ARRAY['old-testament']),

    ('Ruth', '{
      "action":"remained loyal to Naomi and became an ancestor of King David",
      "pair_partner":"Naomi"
    }'::jsonb, 2, ARRAY['old-testament']),

    ('Job', '{
      "action":"endured great suffering and remained faithful to God"
    }'::jsonb, 3, ARRAY['old-testament']),

    ('Isaiah', '{
      "quote":"Here am I, send me",
      "action":"prophesied the coming of the Messiah"
    }'::jsonb, 2, ARRAY['old-testament', 'prophet']),

    ('Jeremiah', '{
      "action":"was known as the weeping prophet"
    }'::jsonb, 3, ARRAY['old-testament', 'prophet']),

    ('Gideon', '{
      "action":"defeated the Midianites with only 300 men",
      "miracle":"defeating a vast army with only 300 soldiers"
    }'::jsonb, 3, ARRAY['old-testament']),

    ('Deborah', '{
      "action":"was a prophetess and the only female judge of Israel"
    }'::jsonb, 3, ARRAY['old-testament', 'judge']),

    ('Cain', '{
      "action":"was the first murderer, killing his brother Abel"
    }'::jsonb, 3, ARRAY['old-testament', 'genesis']),

    ('Jesus', '{
      "quote":"Love your neighbor as yourself",
      "action":"was crucified and rose from the dead",
      "miracle":"turning water into wine at the wedding in Cana",
      "pair_partner":"John the Baptist"
    }'::jsonb, 1, ARRAY['new-testament', 'gospels']),

    ('Mary', '{
      "action":"was the mother of Jesus",
      "pair_partner":"Joseph"
    }'::jsonb, 1, ARRAY['new-testament', 'gospels']),

    ('Joseph', '{
      "action":"was the earthly father of Jesus"
    }'::jsonb, 2, ARRAY['new-testament', 'gospels']),

    ('John the Baptist', '{
      "action":"baptized Jesus in the River Jordan",
      "animal_context":"wore camel''s hair clothing",
      "pair_partner":"Jesus"
    }'::jsonb, 2, ARRAY['new-testament', 'gospels']),

    ('Peter', '{
      "quote":"You are the Christ, the Son of the living God",
      "action":"denied Jesus three times and later became the leader of the apostles",
      "miracle":"walking on water",
      "object_context":"was given the keys to the kingdom of heaven",
      "pair_partner":"Paul"
    }'::jsonb, 2, ARRAY['new-testament', 'apostle']),

    ('Paul', '{
      "quote":"I have fought the good fight, I have finished the race",
      "action":"was converted on the road to Damascus and spread the gospel",
      "miracle":"surviving a shipwreck and a snake bite",
      "pair_partner":"Peter"
    }'::jsonb, 2, ARRAY['new-testament', 'apostle']),

    ('John', '{
      "action":"was the beloved disciple of Jesus",
      "pair_partner":"James"
    }'::jsonb, 2, ARRAY['new-testament', 'apostle']),

    ('Thomas', '{
      "action":"doubted the resurrection of Jesus until he saw the wounds"
    }'::jsonb, 2, ARRAY['new-testament', 'apostle']),

    ('Judas Iscariot', '{
      "action":"betrayed Jesus for thirty pieces of silver",
      "object_context":"betrayed Jesus with a kiss",
      "pair_partner":"Jesus"
    }'::jsonb, 2, ARRAY['new-testament', 'apostle']),

    ('Stephen', '{
      "action":"was the first Christian martyr, stoned to death"
    }'::jsonb, 3, ARRAY['new-testament']),

    ('Mary Magdalene', '{
      "action":"was the first person to see the risen Jesus"
    }'::jsonb, 3, ARRAY['new-testament']),

    ('Lazarus', '{
      "action":"was raised from the dead by Jesus",
      "miracle":"being raised from the dead after four days"
    }'::jsonb, 3, ARRAY['new-testament']),

    ('Zacchaeus', '{
      "action":"was a tax collector who climbed a sycamore tree to see Jesus",
      "object_context":"climbed a sycamore tree to see Jesus"
    }'::jsonb, 3, ARRAY['new-testament'])
),
inserted_entities AS (
  INSERT INTO public.entities (topic_id, type_id, label, difficulty, tags)
  SELECT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      (SELECT id FROM public.entity_types WHERE name = 'Person' AND topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')),
      label, difficulty, tags
  FROM input_data
  RETURNING id, label
),
register_predicates AS (
  INSERT INTO public.predicates (topic_id, name, value_type)
  SELECT DISTINCT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      key,
      'text'
  FROM input_data,
  LATERAL jsonb_each_text(metadata)
  ON CONFLICT (topic_id, name) DO NOTHING
)
INSERT INTO public.facts (subject_id, predicate_id, value)
SELECT
    e.id, p.id, kv.value
FROM input_data t
JOIN inserted_entities e ON e.label = t.label
CROSS JOIN LATERAL jsonb_each_text(t.metadata) kv
JOIN public.predicates p ON p.name = kv.key AND p.topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 5. BOOKS OF THE BIBLE
-- ═══════════════════════════════════════════════════════════════════
WITH input_data (label, metadata, difficulty, tags) AS (
  VALUES
    ('Genesis',    '{"event":"the creation of the world and the patriarchs"}'::jsonb, 1, ARRAY['old-testament', 'pentateuch']),
    ('Exodus',     '{"event":"the Israelites'' escape from Egypt"}'::jsonb, 1, ARRAY['old-testament', 'pentateuch']),
    ('Leviticus',  '{"event":"the laws and rituals for the priesthood"}'::jsonb, 3, ARRAY['old-testament', 'pentateuch']),
    ('Numbers',    '{"event":"the Israelites'' journey through the wilderness"}'::jsonb, 2, ARRAY['old-testament', 'pentateuch']),
    ('Deuteronomy','{"event":"Moses'' final speeches to the Israelites"}'::jsonb, 3, ARRAY['old-testament', 'pentateuch']),
    ('Joshua',     '{"event":"the conquest of the Promised Land"}'::jsonb, 2, ARRAY['old-testament', 'history']),
    ('Judges',     '{"event":"the cycle of Israel''s judges and deliverance"}'::jsonb, 2, ARRAY['old-testament', 'history']),
    ('Ruth',       '{"event":"the story of Ruth and Naomi''s loyalty"}'::jsonb, 2, ARRAY['old-testament', 'history']),
    ('1 Samuel',   '{"event":"the rise of King David and the reign of Saul"}'::jsonb, 2, ARRAY['old-testament', 'history']),
    ('2 Samuel',   '{"event":"the reign of King David"}'::jsonb, 2, ARRAY['old-testament', 'history']),
    ('1 Kings',    '{"event":"the reign of Solomon and the divided kingdom"}'::jsonb, 2, ARRAY['old-testament', 'history']),
    ('Psalms',     '{"event":"the songs and prayers of Israel"}'::jsonb, 1, ARRAY['old-testament', 'poetry']),
    ('Proverbs',   '{"event":"wisdom sayings for daily living"}'::jsonb, 2, ARRAY['old-testament', 'poetry']),
    ('Isaiah',     '{"event":"prophecies about judgment and the coming Messiah"}'::jsonb, 3, ARRAY['old-testament', 'prophets']),
    ('Jeremiah',   '{"event":"warnings of Jerusalem''s destruction"}'::jsonb, 3, ARRAY['old-testament', 'prophets']),
    ('Daniel',     '{"event":"visions of future kingdoms and end times"}'::jsonb, 3, ARRAY['old-testament', 'prophets']),
    ('Jonah',      '{"event":"the prophet who ran from God''s call"}'::jsonb, 2, ARRAY['old-testament', 'prophets']),
    ('Matthew',    '{"event":"the life and teachings of Jesus as the promised King"}'::jsonb, 1, ARRAY['new-testament', 'gospels']),
    ('Mark',       '{"event":"the action-packed account of Jesus'' ministry"}'::jsonb, 1, ARRAY['new-testament', 'gospels']),
    ('Luke',       '{"event":"the detailed account of Jesus'' life and parables"}'::jsonb, 1, ARRAY['new-testament', 'gospels']),
    ('John',       '{"event":"the divine nature and identity of Jesus Christ"}'::jsonb, 1, ARRAY['new-testament', 'gospels']),
    ('Acts',       '{"event":"the early church and the spread of the gospel"}'::jsonb, 2, ARRAY['new-testament']),
    ('Revelation', '{"event":"the end times and the final victory of God"}'::jsonb, 3, ARRAY['new-testament'])
),
inserted_entities AS (
  INSERT INTO public.entities (topic_id, type_id, label, difficulty, tags)
  SELECT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      (SELECT id FROM public.entity_types WHERE name = 'Book' AND topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')),
      label, difficulty, tags
  FROM input_data
  RETURNING id, label
),
register_predicates AS (
  INSERT INTO public.predicates (topic_id, name, value_type)
  SELECT DISTINCT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      key, 'text'
  FROM input_data,
  LATERAL jsonb_each_text(metadata)
  ON CONFLICT (topic_id, name) DO NOTHING
)
INSERT INTO public.facts (subject_id, predicate_id, value)
SELECT e.id, p.id, kv.value
FROM input_data t
JOIN inserted_entities e ON e.label = t.label
CROSS JOIN LATERAL jsonb_each_text(t.metadata) kv
JOIN public.predicates p ON p.name = kv.key AND p.topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 6. LOCATIONS
-- ═══════════════════════════════════════════════════════════════════
WITH input_data (label, metadata, difficulty, tags) AS (
  VALUES
    ('the Garden of Eden',  '{"event":"the creation of Adam and Eve"}'::jsonb, 1, ARRAY['old-testament', 'genesis']),
    ('Mount Ararat',        '{"event":"Noah''s ark coming to rest after the flood"}'::jsonb, 2, ARRAY['old-testament', 'genesis']),
    ('Mount Sinai',         '{"event":"Moses receiving the Ten Commandments"}'::jsonb, 1, ARRAY['old-testament', 'exodus']),
    ('Jericho',             '{"event":"the walls falling down after Joshua''s army marched"}'::jsonb, 2, ARRAY['old-testament', 'joshua']),
    ('Bethlehem',           '{"event":"the birth of Jesus Christ"}'::jsonb, 1, ARRAY['new-testament', 'gospels']),
    ('Jerusalem',           '{"event":"the crucifixion and resurrection of Jesus"}'::jsonb, 1, ARRAY['new-testament', 'gospels']),
    ('Nazareth',            '{"event":"Jesus growing up as a child"}'::jsonb, 2, ARRAY['new-testament', 'gospels']),
    ('the Sea of Galilee',  '{"event":"Jesus walking on water and calming the storm"}'::jsonb, 2, ARRAY['new-testament', 'gospels']),
    ('the Red Sea',         '{"event":"the Israelites crossing on dry ground"}'::jsonb, 2, ARRAY['old-testament', 'exodus']),
    ('the River Jordan',    '{"event":"Jesus being baptized by John the Baptist"}'::jsonb, 2, ARRAY['new-testament', 'gospels']),
    ('Gethsemane',          '{"event":"Jesus praying before his arrest"}'::jsonb, 2, ARRAY['new-testament', 'gospels']),
    ('Calvary',             '{"event":"the crucifixion of Jesus"}'::jsonb, 2, ARRAY['new-testament', 'gospels']),
    ('Babylon',             '{"event":"the Israelites being held in captivity"}'::jsonb, 3, ARRAY['old-testament', 'history']),
    ('Cana',                '{"event":"Jesus turning water into wine at a wedding"}'::jsonb, 3, ARRAY['new-testament', 'gospels'])
),
inserted_entities AS (
  INSERT INTO public.entities (topic_id, type_id, label, difficulty, tags)
  SELECT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      (SELECT id FROM public.entity_types WHERE name = 'Location' AND topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')),
      label, difficulty, tags
  FROM input_data
  RETURNING id, label
),
register_predicates AS (
  INSERT INTO public.predicates (topic_id, name, value_type)
  SELECT DISTINCT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      key, 'text'
  FROM input_data,
  LATERAL jsonb_each_text(metadata)
  ON CONFLICT (topic_id, name) DO NOTHING
)
INSERT INTO public.facts (subject_id, predicate_id, value)
SELECT e.id, p.id, kv.value
FROM input_data t
JOIN inserted_entities e ON e.label = t.label
CROSS JOIN LATERAL jsonb_each_text(t.metadata) kv
JOIN public.predicates p ON p.name = kv.key AND p.topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 7. NUMBERS
-- ═══════════════════════════════════════════════════════════════════
WITH input_data (label, metadata, difficulty, tags) AS (
  VALUES
    ('6',  '{"number_context":"days of creation"}'::jsonb, 1, ARRAY['number']),
    ('7',  '{"number_context":"days in a week according to creation"}'::jsonb, 1, ARRAY['number']),
    ('10', '{"number_context":"commandments given to Moses"}'::jsonb, 1, ARRAY['number']),
    ('12', '{"number_context":"tribes of Israel"}'::jsonb, 1, ARRAY['number']),
    ('40', '{"number_context":"days and nights of rain during Noah''s flood"}'::jsonb, 1, ARRAY['number']),
    ('3',  '{"number_context":"days Jesus spent in the tomb"}'::jsonb, 1, ARRAY['number']),
    ('30', '{"number_context":"pieces of silver paid to Judas"}'::jsonb, 2, ARRAY['number']),
    ('70', '{"number_context":"times seven that we should forgive someone"}'::jsonb, 3, ARRAY['number']),
    ('5',  '{"number_context":"loaves used by Jesus to feed the five thousand"}'::jsonb, 2, ARRAY['number']),
    ('2',  '{"number_context":"of every kind of animal taken on the ark"}'::jsonb, 2, ARRAY['number'])
),
inserted_entities AS (
  INSERT INTO public.entities (topic_id, type_id, label, difficulty, tags)
  SELECT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      (SELECT id FROM public.entity_types WHERE name = 'NumberFact' AND topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')),
      label, difficulty, tags
  FROM input_data
  RETURNING id, label
),
register_predicates AS (
  INSERT INTO public.predicates (topic_id, name, value_type)
  SELECT DISTINCT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      key, 'text'
  FROM input_data,
  LATERAL jsonb_each_text(metadata)
  ON CONFLICT (topic_id, name) DO NOTHING
)
INSERT INTO public.facts (subject_id, predicate_id, value)
SELECT e.id, p.id, kv.value
FROM input_data t
JOIN inserted_entities e ON e.label = t.label
CROSS JOIN LATERAL jsonb_each_text(t.metadata) kv
JOIN public.predicates p ON p.name = kv.key AND p.topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')
ON CONFLICT DO NOTHING;
