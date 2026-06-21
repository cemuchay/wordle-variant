-- English idioms / proverbs for word-up procedural generation
-- Each entry has:
--   meaning   → plain-english definition (uses language_arts / definition prompt path)
--   example   → sentence usage (uses promptFormatter "example" templates)
--   origin    → historical / cultural etymology (generic key → default templates)

INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES

-- Easy (1-2) — widely known idioms
('english_idioms', 'Spill the beans', '{"meaning": "reveal a secret", "example": "She spilled the beans about the surprise party.", "origin": "Ancient Greek voting where beans were used as ballots"}', 1, ARRAY['easy', 'idiom']),
('english_idioms', 'Piece of cake', '{"meaning": "very easy", "example": "The exam was a piece of cake.", "origin": "1930s American slang for something pleasant"}', 1, ARRAY['easy', 'idiom']),
('english_idioms', 'Break the ice', '{"meaning": "initiate conversation in a social setting", "example": "He told a joke to break the ice at the meeting.", "origin": "sailing metaphor where ice-breaking ships clear a path"}', 1, ARRAY['easy', 'idiom']),
('english_idioms', 'Under the weather', '{"meaning": "feeling ill or unwell", "example": "I am feeling under the weather today.", "origin": "nautical term for seasickness caused by bad weather"}', 1, ARRAY['easy', 'idiom']),
('english_idioms', 'Hit the sack', '{"meaning": "go to bed", "example": "I am exhausted, time to hit the sack.", "origin": "early 20th century when sacks were used as makeshift mattresses"}', 1, ARRAY['easy', 'idiom']),
('english_idioms', 'Cost an arm and a leg', '{"meaning": "very expensive", "example": "That designer bag costs an arm and a leg.", "origin": "post-World War Two American slang for extreme cost"}', 2, ARRAY['easy', 'idiom']),
('english_idioms', 'Not my cup of tea', '{"meaning": "not something one enjoys", "example": "Horror movies are not my cup of tea.", "origin": "early 20th century British slang"}', 1, ARRAY['easy', 'idiom']),
('english_idioms', 'Pull someones leg', '{"meaning": "joke or tease someone playfully", "example": "Relax, I am just pulling your leg.", "origin": "19th century thieves who tripped victims before robbing them"}', 2, ARRAY['easy', 'idiom']),

-- Medium (3) — idioms that require cultural familiarity
('english_idioms', 'Bite the bullet', '{"meaning": "face something unpleasant with courage", "example": "I will bite the bullet and go to the dentist.", "origin": "battlefield surgery where soldiers bit on bullets to endure pain"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Hit the nail on the head', '{"meaning": "describe exactly what is causing a situation", "example": "You hit the nail on the head with that diagnosis.", "origin": "carpentry metaphor for precise hammer strikes"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Let the cat out of the bag', '{"meaning": "reveal a secret unintentionally", "example": "He let the cat out of the bag about the layoffs.", "origin": "market fraud where sellers swapped cats for piglets in bags"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Once in a blue moon', '{"meaning": "very rarely", "example": "I visit my hometown once in a blue moon.", "origin": "rare astronomical event when a second full moon appears in a month"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Burn the midnight oil', '{"meaning": "work late into the night", "example": "She burned the midnight oil studying for finals.", "origin": "literal oil lamps used before electric lighting"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Caught red handed', '{"meaning": "caught in the act of wrongdoing", "example": "The thief was caught red-handed.", "origin": "old Scottish law requiring visible blood on a murder suspect hands"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Curiosity killed the cat', '{"meaning": "being too inquisitive can lead to trouble", "example": "Do not ask too many questions curiosity killed the cat.", "origin": "16th century English proverb about risky nosiness"}', 3, ARRAY['medium', 'idiom']),
('english_idioms', 'Jump on the bandwagon', '{"meaning": "join a popular trend", "example": "Everyone jumped on the bandwagon when the new app launched.", "origin": "19th century political parades featuring bandwagons for candidates"}', 3, ARRAY['medium', 'idiom']),

-- Hard (4-5) — less common or more complex idioms
('english_idioms', 'Kill two birds with one stone', '{"meaning": "accomplish two goals with a single action", "example": "I will pick up groceries on the way home and kill two birds with one stone.", "origin": "ancient Greek philosophy of achieving dual outcomes"}', 4, ARRAY['hard', 'idiom']),
('english_idioms', 'Play devils advocate', '{"meaning": "argue a contrary position for the sake of debate", "example": "Let me play devils advocate for a moment.", "origin": "Catholic Church practice of appointing an official to argue against canonization"}', 4, ARRAY['hard', 'idiom']),
('english_idioms', 'Steal someones thunder', '{"meaning": "take credit for someone else idea or achievement", "example": "She stole my thunder by announcing my own idea at the meeting.", "origin": "18th century playwright John Dennis who invented a thunder sound effect that others copied"}', 4, ARRAY['hard', 'idiom']),
('english_idioms', 'The ball is in your court', '{"meaning": "it is your turn to take action or decide", "example": "I have made my offer the ball is in your court.", "origin": "tennis and sports metaphor for whose turn it is to act"}', 4, ARRAY['hard', 'idiom']),
('english_idioms', 'Bury the hatchet', '{"meaning": "end a conflict and make peace", "example": "After years of rivalry they finally buried the hatchet.", "origin": "Native American custom of burying weapons as a peace ritual"}', 5, ARRAY['hard', 'idiom']),
('english_idioms', 'Elephant in the room', '{"meaning": "an obvious problem that everyone avoids discussing", "example": "Nobody mentioned the layoffs that was the elephant in the room.", "origin": "early 20th century phrase for an obvious inconvenient truth"}', 5, ARRAY['hard', 'idiom']);
