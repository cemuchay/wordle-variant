-- Seed script for missing procedural categories (50 entries each)
-- Adjust the number of rows per category as needed.

INSERT INTO wordup_entities (entity_id, super_category, category, content, tags, image_url)
SELECT gen_random_uuid(), 'creative_work', 'naija_music', jsonb_build_object(
    'title', music.title,
    'artist', music.artist,
    'year', music.year
), ARRAY['music', 'naija', 'song'], 'https://example.com/placeholder.jpg'
FROM (
    SELECT generate_series(1, 50) AS id,
           md5(random()::text) AS title,
           md5(random()::text) AS artist,
           (2020 + floor(random()*5))::int AS year
) AS music;

INSERT INTO wordup_entities (entity_id, super_category, category, content, tags, image_url)
SELECT gen_random_uuid(), 'creative_work', 'naija_celebs', jsonb_build_object(
    'name', celeb.name,
    'profession', celeb.profession,
    'birth_year', celeb.birth_year
), ARRAY['celebrity', 'naija'], 'https://example.com/placeholder.jpg'
FROM (
    SELECT generate_series(1, 50) AS id,
           md5(random()::text) AS name,
           md5(random()::text) AS profession,
           (1970 + floor(random()*30))::int AS birth_year
) AS celeb;

INSERT INTO wordup_entities (entity_id, super_category, category, content, tags, image_url)
SELECT gen_random_uuid(), 'creature', 'unn_lions', jsonb_build_object(
    'name', lion.name,
    'region', lion.region,
    'status', lion.status
), ARRAY['lion', 'unn'], 'https://example.com/placeholder.jpg'
FROM (
    SELECT generate_series(1, 50) AS id,
           md5(random()::text) AS name,
           md5(random()::text) AS region,
           'Vulnerable'::text AS status
) AS lion;

INSERT INTO wordup_entities (entity_id, super_category, category, content, tags, image_url)
SELECT gen_random_uuid(), 'education', 'nysc_trivia', jsonb_build_object(
    'question', trivia.q,
    'answer', trivia.a
), ARRAY['nysc', 'trivia'], 'https://example.com/placeholder.jpg'
FROM (
    SELECT generate_series(1, 50) AS id,
           md5(random()::text) AS q,
           md5(random()::text) AS a
) AS trivia;

INSERT INTO wordup_entities (entity_id, super_category, category, content, tags, image_url)
SELECT gen_random_uuid(), 'technology', 'us_tech_trivia', jsonb_build_object(
    'question', tech.q,
    'answer', tech.a
), ARRAY['us', 'tech', 'trivia'], 'https://example.com/placeholder.jpg'
FROM (
    SELECT generate_series(1, 50) AS id,
           md5(random()::text) AS q,
           md5(random()::text) AS a
) AS tech;

INSERT INTO wordup_entities (entity_id, super_category, category, content, tags, image_url)
SELECT gen_random_uuid(), 'person', 'elon_musk', jsonb_build_object(
    'fact', fact.detail
), ARRAY['elon', 'musk'], 'https://example.com/placeholder.jpg'
FROM (
    SELECT generate_series(1, 50) AS id,
           md5(random()::text) AS detail
) AS fact;
