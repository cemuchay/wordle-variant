-- Strip difficulty-level tags ('easy', 'medium', 'hard') from wordup_entities
-- These leaked into the Tag Match question variant as answer options / distractors.
-- Difficulty is already tracked via the numeric `difficulty` column (1-5).

UPDATE wordup_entities
SET tags = array_remove(array_remove(array_remove(tags, 'easy'), 'medium'), 'hard')
WHERE tags && ARRAY['easy', 'medium', 'hard'];
