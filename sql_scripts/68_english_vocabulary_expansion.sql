-- Supplemental vocabulary seed for english_language (30 words, style-diverse)
-- Avoids overlap with the 100 words in 66_english_vocabulary_seed.sql

INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES

-- Easy (Difficulty 1-2) — concrete, everyday words
('english_vocabulary', 'Ardent', '{"synonym": "passionate", "antonym": "indifferent", "definition": "showing strong feeling or enthusiasm"}', 1, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Bland', '{"synonym": "plain", "antonym": "exciting", "definition": "lacking strong features and therefore uninteresting"}', 1, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Capable', '{"synonym": "competent", "antonym": "incompetent", "definition": "having the ability or qualities to do something"}', 1, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Dreadful', '{"synonym": "terrible", "antonym": "wonderful", "definition": "causing great suffering or distress"}', 2, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Earnest', '{"synonym": "sincere", "antonym": "frivolous", "definition": "showing sincere and intense conviction"}', 1, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Fierce', '{"synonym": "ferocious", "antonym": "gentle", "definition": "having or displaying a violent or ferocious nature"}', 2, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Grim', '{"synonym": "somber", "antonym": "cheerful", "definition": "very serious and gloomy in manner or appearance"}', 2, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Humble', '{"synonym": "modest", "antonym": "arrogant", "definition": "having or showing a modest estimate of one''s importance"}', 1, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Lively', '{"synonym": "vibrant", "antonym": "dull", "definition": "full of life and energy"}', 1, ARRAY['easy', 'adjectives']),
('english_vocabulary', 'Ponder', '{"synonym": "contemplate", "antonym": "disregard", "definition": "think about something carefully"}', 2, ARRAY['easy', 'verbs']),

-- Medium (Difficulty 3) — action-oriented and descriptive
('english_vocabulary', 'Accord', '{"synonym": "harmony", "antonym": "discord", "definition": "an official agreement or treaty"}', 3, ARRAY['medium', 'nouns']),
('english_vocabulary', 'Bewilder', '{"synonym": "perplex", "antonym": "enlighten", "definition": "cause someone to become confused"}', 3, ARRAY['medium', 'verbs']),
('english_vocabulary', 'Compel', '{"synonym": "oblige", "antonym": "deter", "definition": "force or oblige someone to do something"}', 3, ARRAY['medium', 'verbs']),
('english_vocabulary', 'Disdain', '{"synonym": "scorn", "antonym": "admiration", "definition": "the feeling that someone is unworthy of respect"}', 3, ARRAY['medium', 'nouns']),
('english_vocabulary', 'Elaborate', '{"synonym": "intricate", "antonym": "simple", "definition": "involving many carefully arranged parts or details"}', 3, ARRAY['medium', 'adjectives']),
('english_vocabulary', 'Feign', '{"synonym": "simulate", "antonym": "reveal", "definition": "pretend to be affected by a feeling or state"}', 3, ARRAY['medium', 'verbs']),
('english_vocabulary', 'Gruesome', '{"synonym": "grisly", "antonym": "pleasant", "definition": "causing repulsion or horror"}', 3, ARRAY['medium', 'adjectives']),
('english_vocabulary', 'Hesitate', '{"synonym": "waver", "antonym": "persist", "definition": "pause before saying or doing something"}', 3, ARRAY['medium', 'verbs']),
('english_vocabulary', 'Imminent', '{"synonym": "impending", "antonym": "distant", "definition": "about to happen"}', 3, ARRAY['medium', 'adjectives']),
('english_vocabulary', 'Jovial', '{"synonym": "merry", "antonym": "miserable", "definition": "cheerful and friendly in disposition"}', 3, ARRAY['medium', 'adjectives']),

-- Hard (Difficulty 4-5) — more abstract and sophisticated
('english_vocabulary', 'Lethargic', '{"synonym": "sluggish", "antonym": "energetic", "definition": "affected by a lack of energy or enthusiasm"}', 4, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Mundane', '{"synonym": "commonplace", "antonym": "extraordinary", "definition": "lacking interest or excitement"}', 4, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Nonchalant', '{"synonym": "unconcerned", "antonym": "anxious", "definition": "feeling or appearing casually calm and relaxed"}', 4, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Oppressive', '{"synonym": "tyrannical", "antonym": "liberating", "definition": "exercising harsh and cruel authority"}', 4, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Precede', '{"synonym": "antecede", "antonym": "follow", "definition": "come before in time or order"}', 5, ARRAY['hard', 'verbs']),
('english_vocabulary', 'Ravenous', '{"synonym": "famished", "antonym": "satiated", "definition": "extremely hungry"}', 4, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Scrupulous', '{"synonym": "conscientious", "antonym": "unscrupulous", "definition": "diligent and thorough in attending to details"}', 5, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Tenacious', '{"synonym": "unyielding", "antonym": "yielding", "definition": "holding firmly to something"}', 5, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Vivid', '{"synonym": "striking", "antonym": "faint", "definition": "producing powerful feelings or clear images"}', 4, ARRAY['hard', 'adjectives']),
('english_vocabulary', 'Wrath', '{"synonym": "fury", "antonym": "serenity", "definition": "extreme anger"}', 4, ARRAY['hard', 'nouns']);
