-- 111_fix_bible_entities_facts.sql
-- Fixes the Bible facts seeding by splitting predicate registration from entity/fact insertion.
-- This resolves the Postgres CTE visibility issue where predicates inserted in the CTE 
-- are not yet visible to the join in the same statement.

-- 1. Ensure all predicates are inserted and committed first
INSERT INTO public.predicates (topic_id, name, value_type)
VALUES
  ((SELECT id FROM public.topics WHERE slug = 'bible'), 'canonical_order', 'integer'),
  ((SELECT id FROM public.topics WHERE slug = 'bible'), 'chapter_count', 'integer'),
  ((SELECT id FROM public.topics WHERE slug = 'bible'), 'testament', 'text'),
  ((SELECT id FROM public.topics WHERE slug = 'bible'), 'previous_book', 'text'),
  ((SELECT id FROM public.topics WHERE slug = 'bible'), 'next_book', 'text')
ON CONFLICT (topic_id, name) DO NOTHING;

-- 2. Clean up previous empty-metadata entities
DELETE FROM public.entities
WHERE topic_id = (SELECT id FROM public.topics WHERE slug = 'bible');

-- 3. Seed entities and facts (joining now-visible predicates)
WITH input_data (label, metadata, difficulty, tags) AS (
  VALUES
    -- Old Testament (canonical_order 1-39)
    ('Genesis',       '{"canonical_order":1,  "chapter_count":50, "testament":"Old", "previous_book":"",           "next_book":"Exodus"}'::jsonb,      1, ARRAY['old-testament']),
    ('Exodus',        '{"canonical_order":2,  "chapter_count":40, "testament":"Old", "previous_book":"Genesis",    "next_book":"Leviticus"}'::jsonb,   1, ARRAY['old-testament']),
    ('Leviticus',     '{"canonical_order":3,  "chapter_count":27, "testament":"Old", "previous_book":"Exodus",     "next_book":"Numbers"}'::jsonb,     2, ARRAY['old-testament']),
    ('Numbers',       '{"canonical_order":4,  "chapter_count":36, "testament":"Old", "previous_book":"Leviticus",  "next_book":"Deuteronomy"}'::jsonb, 2, ARRAY['old-testament']),
    ('Deuteronomy',   '{"canonical_order":5,  "chapter_count":34, "testament":"Old", "previous_book":"Numbers",    "next_book":"Joshua"}'::jsonb,     2, ARRAY['old-testament']),
    ('Joshua',        '{"canonical_order":6,  "chapter_count":24, "testament":"Old", "previous_book":"Deuteronomy","next_book":"Judges"}'::jsonb,      2, ARRAY['old-testament']),
    ('Judges',        '{"canonical_order":7,  "chapter_count":21, "testament":"Old", "previous_book":"Joshua",     "next_book":"Ruth"}'::jsonb,       2, ARRAY['old-testament']),
    ('Ruth',          '{"canonical_order":8,  "chapter_count":4,  "testament":"Old", "previous_book":"Judges",     "next_book":"1 Samuel"}'::jsonb,   2, ARRAY['old-testament']),
    ('1 Samuel',      '{"canonical_order":9,  "chapter_count":31, "testament":"Old", "previous_book":"Ruth",       "next_book":"2 Samuel"}'::jsonb,   2, ARRAY['old-testament']),
    ('2 Samuel',      '{"canonical_order":10, "chapter_count":24, "testament":"Old", "previous_book":"1 Samuel",   "next_book":"1 Kings"}'::jsonb,    2, ARRAY['old-testament']),
    ('1 Kings',       '{"canonical_order":11, "chapter_count":22, "testament":"Old", "previous_book":"2 Samuel",   "next_book":"2 Kings"}'::jsonb,    2, ARRAY['old-testament']),
    ('2 Kings',       '{"canonical_order":12, "chapter_count":25, "testament":"Old", "previous_book":"1 Kings",    "next_book":"1 Chronicles"}'::jsonb,2, ARRAY['old-testament']),
    ('1 Chronicles',  '{"canonical_order":13, "chapter_count":29, "testament":"Old", "previous_book":"2 Kings",     "next_book":"2 Chronicles"}'::jsonb,3, ARRAY['old-testament']),
    ('2 Chronicles',  '{"canonical_order":14, "chapter_count":36, "testament":"Old", "previous_book":"1 Chronicles","next_book":"Ezra"}'::jsonb,      3, ARRAY['old-testament']),
    ('Ezra',          '{"canonical_order":15, "chapter_count":10, "testament":"Old", "previous_book":"2 Chronicles","next_book":"Nehemiah"}'::jsonb,  3, ARRAY['old-testament']),
    ('Nehemiah',      '{"canonical_order":16, "chapter_count":13, "testament":"Old", "previous_book":"Ezra",        "next_book":"Esther"}'::jsonb,    3, ARRAY['old-testament']),
    ('Esther',        '{"canonical_order":17, "chapter_count":10, "testament":"Old", "previous_book":"Nehemiah",    "next_book":"Job"}'::jsonb,       2, ARRAY['old-testament']),
    ('Job',           '{"canonical_order":18, "chapter_count":42, "testament":"Old", "previous_book":"Esther",      "next_book":"Psalms"}'::jsonb,    2, ARRAY['old-testament']),
    ('Psalms',        '{"canonical_order":19, "chapter_count":150,"testament":"Old", "previous_book":"Job",         "next_book":"Proverbs"}'::jsonb,  1, ARRAY['old-testament']),
    ('Proverbs',      '{"canonical_order":20, "chapter_count":31, "testament":"Old", "previous_book":"Psalms",      "next_book":"Ecclesiastes"}'::jsonb,1, ARRAY['old-testament']),
    ('Ecclesiastes',  '{"canonical_order":21, "chapter_count":12, "testament":"Old", "previous_book":"Proverbs",    "next_book":"Song of Solomon"}'::jsonb,3, ARRAY['old-testament']),
    ('Song of Solomon','{"canonical_order":22, "chapter_count":8,  "testament":"Old", "previous_book":"Ecclesiastes","next_book":"Isaiah"}'::jsonb,   3, ARRAY['old-testament']),
    ('Isaiah',        '{"canonical_order":23, "chapter_count":66, "testament":"Old", "previous_book":"Song of Solomon","next_book":"Jeremiah"}'::jsonb,1, ARRAY['old-testament']),
    ('Jeremiah',      '{"canonical_order":24, "chapter_count":52, "testament":"Old", "previous_book":"Isaiah",      "next_book":"Lamentations"}'::jsonb,2, ARRAY['old-testament']),
    ('Lamentations',  '{"canonical_order":25, "chapter_count":5,  "testament":"Old", "previous_book":"Jeremiah",    "next_book":"Ezekiel"}'::jsonb,   3, ARRAY['old-testament']),
    ('Ezekiel',       '{"canonical_order":26, "chapter_count":48, "testament":"Old", "previous_book":"Lamentations","next_book":"Daniel"}'::jsonb,    2, ARRAY['old-testament']),
    ('Daniel',        '{"canonical_order":27, "chapter_count":12, "testament":"Old", "previous_book":"Ezekiel",     "next_book":"Hosea"}'::jsonb,     1, ARRAY['old-testament']),
    ('Hosea',         '{"canonical_order":28, "chapter_count":14, "testament":"Old", "previous_book":"Daniel",      "next_book":"Joel"}'::jsonb,      3, ARRAY['old-testament']),
    ('Joel',          '{"canonical_order":29, "chapter_count":3,  "testament":"Old", "previous_book":"Hosea",       "next_book":"Amos"}'::jsonb,      3, ARRAY['old-testament']),
    ('Amos',          '{"canonical_order":30, "chapter_count":9,  "testament":"Old", "previous_book":"Joel",        "next_book":"Obadiah"}'::jsonb,   3, ARRAY['old-testament']),
    ('Obadiah',       '{"canonical_order":31, "chapter_count":1,  "testament":"Old", "previous_book":"Amos",        "next_book":"Jonah"}'::jsonb,     3, ARRAY['old-testament']),
    ('Jonah',         '{"canonical_order":32, "chapter_count":4,  "testament":"Old", "previous_book":"Obadiah",     "next_book":"Micah"}'::jsonb,     2, ARRAY['old-testament']),
    ('Micah',         '{"canonical_order":33, "chapter_count":7,  "testament":"Old", "previous_book":"Jonah",       "next_book":"Nahum"}'::jsonb,     3, ARRAY['old-testament']),
    ('Nahum',         '{"canonical_order":34, "chapter_count":3,  "testament":"Old", "previous_book":"Micah",       "next_book":"Habakkuk"}'::jsonb,  3, ARRAY['old-testament']),
    ('Habakkuk',      '{"canonical_order":35, "chapter_count":3,  "testament":"Old", "previous_book":"Nahum",       "next_book":"Zephaniah"}'::jsonb, 3, ARRAY['old-testament']),
    ('Zephaniah',     '{"canonical_order":36, "chapter_count":3,  "testament":"Old", "previous_book":"Habakkuk",    "next_book":"Haggai"}'::jsonb,   3, ARRAY['old-testament']),
    ('Haggai',        '{"canonical_order":37, "chapter_count":2,  "testament":"Old", "previous_book":"Zephaniah",   "next_book":"Zechariah"}'::jsonb, 3, ARRAY['old-testament']),
    ('Zechariah',     '{"canonical_order":38, "chapter_count":14, "testament":"Old", "previous_book":"Haggai",      "next_book":"Malachi"}'::jsonb,   3, ARRAY['old-testament']),
    ('Malachi',       '{"canonical_order":39, "chapter_count":4,  "testament":"Old", "previous_book":"Zechariah",   "next_book":"Matthew"}'::jsonb,   3, ARRAY['old-testament']),

    -- New Testament (canonical_order 40-66)
    ('Matthew',       '{"canonical_order":40, "chapter_count":28, "testament":"New",  "previous_book":"Malachi",    "next_book":"Mark"}'::jsonb,      1, ARRAY['new-testament']),
    ('Mark',          '{"canonical_order":41, "chapter_count":16, "testament":"New", "previous_book":"Matthew",    "next_book":"Luke"}'::jsonb,       1, ARRAY['new-testament']),
    ('Luke',          '{"canonical_order":42, "chapter_count":24, "testament":"New", "previous_book":"Mark",       "next_book":"John"}'::jsonb,       1, ARRAY['new-testament']),
    ('John',          '{"canonical_order":43, "chapter_count":21, "testament":"New", "previous_book":"Luke",       "next_book":"Acts"}'::jsonb,       1, ARRAY['new-testament']),
    ('Acts',          '{"canonical_order":44, "chapter_count":28, "testament":"New", "previous_book":"John",       "next_book":"Romans"}'::jsonb,     1, ARRAY['new-testament']),
    ('Romans',        '{"canonical_order":45, "chapter_count":16, "testament":"New", "previous_book":"Acts",       "next_book":"1 Corinthians"}'::jsonb,1, ARRAY['new-testament']),
    ('1 Corinthians', '{"canonical_order":46, "chapter_count":16, "testament":"New", "previous_book":"Romans",     "next_book":"2 Corinthians"}'::jsonb,2, ARRAY['new-testament']),
    ('2 Corinthians', '{"canonical_order":47, "chapter_count":13, "testament":"New", "previous_book":"1 Corinthians","next_book":"Galatians"}'::jsonb,2, ARRAY['new-testament']),
    ('Galatians',     '{"canonical_order":48, "chapter_count":6,  "testament":"New", "previous_book":"2 Corinthians","next_book":"Ephesians"}'::jsonb,2, ARRAY['new-testament']),
    ('Ephesians',     '{"canonical_order":49, "chapter_count":6,  "testament":"New", "previous_book":"Galatians",  "next_book":"Philippians"}'::jsonb,2, ARRAY['new-testament']),
    ('Philippians',   '{"canonical_order":50, "chapter_count":4,  "testament":"New", "previous_book":"Ephesians",  "next_book":"Colossians"}'::jsonb, 2, ARRAY['new-testament']),
    ('Colossians',    '{"canonical_order":51, "chapter_count":4,  "testament":"New", "previous_book":"Philippians","next_book":"1 Thessalonians"}'::jsonb,2, ARRAY['new-testament']),
    ('1 Thessalonians','{"canonical_order":52, "chapter_count":5, "testament":"New", "previous_book":"Colossians", "next_book":"2 Thessalonians"}'::jsonb,3, ARRAY['new-testament']),
    ('2 Thessalonians','{"canonical_order":53, "chapter_count":3, "testament":"New", "previous_book":"1 Thessalonians","next_book":"1 Timothy"}'::jsonb,3, ARRAY['new-testament']),
    ('1 Timothy',     '{"canonical_order":54, "chapter_count":6,  "testament":"New", "previous_book":"2 Thessalonians","next_book":"2 Timothy"}'::jsonb,3, ARRAY['new-testament']),
    ('2 Timothy',     '{"canonical_order":55, "chapter_count":4,  "testament":"New", "previous_book":"1 Timothy",  "next_book":"Titus"}'::jsonb,      3, ARRAY['new-testament']),
    ('Titus',         '{"canonical_order":56, "chapter_count":3,  "testament":"New", "previous_book":"2 Timothy",  "next_book":"Philemon"}'::jsonb,   3, ARRAY['new-testament']),
    ('Philemon',      '{"canonical_order":57, "chapter_count":1,  "testament":"New", "previous_book":"Titus",      "next_book":"Hebrews"}'::jsonb,    3, ARRAY['new-testament']),
    ('Hebrews',       '{"canonical_order":58, "chapter_count":13, "testament":"New", "previous_book":"Philemon",   "next_book":"James"}'::jsonb,      2, ARRAY['new-testament']),
    ('James',         '{"canonical_order":59, "chapter_count":5,  "testament":"New", "previous_book":"Hebrews",    "next_book":"1 Peter"}'::jsonb,    3, ARRAY['new-testament']),
    ('1 Peter',       '{"canonical_order":60, "chapter_count":5,  "testament":"New", "previous_book":"James",      "next_book":"2 Peter"}'::jsonb,    2, ARRAY['new-testament']),
    ('2 Peter',       '{"canonical_order":61, "chapter_count":3,  "testament":"New", "previous_book":"1 Peter",    "next_book":"1 John"}'::jsonb,     3, ARRAY['new-testament']),
    ('1 John',        '{"canonical_order":62, "chapter_count":5,  "testament":"New", "previous_book":"2 Peter",    "next_book":"2 John"}'::jsonb,     2, ARRAY['new-testament']),
    ('2 John',        '{"canonical_order":63, "chapter_count":1,  "testament":"New", "previous_book":"1 John",     "next_book":"3 John"}'::jsonb,     3, ARRAY['new-testament']),
    ('3 John',        '{"canonical_order":64, "chapter_count":1,  "testament":"New", "previous_book":"2 John",     "next_book":"Jude"}'::jsonb,       3, ARRAY['new-testament']),
    ('Jude',          '{"canonical_order":65, "chapter_count":1,  "testament":"New", "previous_book":"3 John",     "next_book":"Revelation"}'::jsonb, 3, ARRAY['new-testament']),
    ('Revelation',    '{"canonical_order":66, "chapter_count":22, "testament":"New", "previous_book":"Jude",       "next_book":""}'::jsonb,          1, ARRAY['new-testament'])
),
inserted_entities AS (
  INSERT INTO public.entities (topic_id, type_id, label, difficulty, tags)
  SELECT
      (SELECT id FROM public.topics WHERE slug = 'bible'),
      (SELECT id FROM public.entity_types WHERE name = 'Book' AND topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')),
      label, difficulty, tags
  FROM input_data
  RETURNING id, label
)
INSERT INTO public.facts (subject_id, predicate_id, value)
SELECT e.id, p.id, kv.value
FROM input_data t
JOIN inserted_entities e ON e.label = t.label
CROSS JOIN LATERAL jsonb_each_text(t.metadata) kv
JOIN public.predicates p ON p.name = kv.key AND p.topic_id = (SELECT id FROM public.topics WHERE slug = 'bible')
ON CONFLICT DO NOTHING;
