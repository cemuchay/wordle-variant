-- Seed data for math_fundamentals and english_fundamentals in wordup_entities

INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
-- Mathematics Fundamentals (12 Entities)
('math_fundamentals', 'Right Triangle', '{"definition": "A triangle with one angle of exactly 90 degrees", "sum_of_angles": "180 degrees", "formula": "a^2 + b^2 = c^2"}', 2, ARRAY['math', 'geometry']),
('math_fundamentals', 'Prime Number', '{"definition": "A number greater than 1 with no divisors other than 1 and itself", "first_prime": "2", "contrast": "Composite Number"}', 2, ARRAY['math', 'arithmetic']),
('math_fundamentals', 'Diameter', '{"relation_to_radius": "2 times the radius", "definition": "A straight line passing through the center of a circle"}', 2, ARRAY['math', 'geometry']),
('math_fundamentals', 'Pi', '{"approximate_value": "3.14159", "definition": "The ratio of a circle''s circumference to its diameter"}', 2, ARRAY['math', 'constants']),
('math_fundamentals', 'Pythagoras', '{"famous_for": "Pythagorean Theorem", "nationality": "Greek", "era": "Ancient Greece"}', 3, ARRAY['math', 'history']),
('math_fundamentals', 'Hypotenuse', '{"definition": "The longest side of a right-angled triangle", "opposite_to": "Right angle"}', 2, ARRAY['math', 'geometry']),
('math_fundamentals', 'Equilateral Triangle', '{"definition": "A triangle in which all three sides are equal", "internal_angles": "60 degrees"}', 3, ARRAY['math', 'geometry']),
('math_fundamentals', 'Parallelogram', '{"definition": "A simple quadrilateral with two pairs of parallel sides", "formula": "base * height"}', 3, ARRAY['math', 'geometry']),
('math_fundamentals', 'Radius', '{"relation_to_diameter": "half of the diameter", "definition": "A straight line from the center to the circumference of a circle"}', 2, ARRAY['math', 'geometry']),
('math_fundamentals', 'Fibonacci', '{"famous_for": "Fibonacci Sequence", "nationality": "Italian", "era": "Middle Ages"}', 3, ARRAY['math', 'history']),
('math_fundamentals', 'Euclid', '{"famous_for": "Father of Geometry", "nationality": "Greek", "era": "Ancient Greece"}', 4, ARRAY['math', 'history']),
('math_fundamentals', 'Newton', '{"famous_for": "Calculus and Laws of Motion", "nationality": "English", "era": "17th Century"}', 4, ARRAY['math', 'history']),

-- English Fundamentals (12 Entities)
('english_fundamentals', 'Metaphor', '{"definition": "A direct comparison of two unrelated things without using like or as", "example": "Time is a thief", "contrast": "Simile"}', 2, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Simile', '{"definition": "A comparison of two unrelated things using like or as", "example": "As brave as a lion", "contrast": "Metaphor"}', 2, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Alliteration', '{"definition": "The repetition of the same initial consonant sound in a sequence of words", "example": "Peter Piper picked a peck of pickled peppers"}', 3, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Hyperbole', '{"definition": "An extreme exaggeration used to make a point or for emphasis", "example": "I am so hungry I could eat a horse"}', 3, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Onomatopoeia', '{"definition": "A word that grammatically mimics the sound it represents", "example": "Buzz, crash, hiss"}', 3, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Noun', '{"definition": "A part of speech that names a person, place, thing, or idea", "example": "London, desk, teacher"}', 2, ARRAY['english', 'grammar']),
('english_fundamentals', 'Verb', '{"definition": "A part of speech that expresses action, occurrence, or state of being", "example": "run, write, exist"}', 2, ARRAY['english', 'grammar']),
('english_fundamentals', 'Adjective', '{"definition": "A part of speech that modifies or describes a noun or pronoun", "example": "beautiful, quick, silent"}', 2, ARRAY['english', 'grammar']),
('english_fundamentals', 'Idiom', '{"definition": "An expression whose meaning is not predictable from the literal meanings of its words", "example": "Spill the beans"}', 3, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Oxymoron', '{"definition": "A figure of speech in which contradictory terms appear in conjunction", "example": "Deafening silence", "contrast": "Pleonasm"}', 4, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Personification', '{"definition": "Giving human characteristics to non-human things", "example": "The wind whispered"}', 3, ARRAY['english', 'literary_devices']),
('english_fundamentals', 'Irony', '{"definition": "The expression of one''s meaning by using language that normally signifies the opposite", "example": "A fire station burning down"}', 4, ARRAY['english', 'literary_devices']);
