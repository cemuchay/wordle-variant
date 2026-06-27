CREATE TABLE IF NOT EXISTS wordup_handcrafted_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    prompt TEXT NOT NULL UNIQUE,
    choices TEXT[] NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    expires_at TIMESTAMPTZ, -- optional expiry for content decay
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries by category and expiry
CREATE INDEX IF NOT EXISTS idx_wordup_handcrafted_category_expiry ON wordup_handcrafted_questions(category, expires_at);

-- Seed premium handcrafted questions
INSERT INTO wordup_handcrafted_questions (category, prompt, choices, answer, explanation) VALUES
-- FOOTBALL
('football', 'When did Chelsea FC last win the Premier League title?', ARRAY['2016/17', '2014/15', '2019/20', '2020/21'], '2016/17', 'Chelsea FC last won the Premier League in the 2016/17 season under manager Antonio Conte.'),
('football', 'Who is the only player to score in a Manchester derby, Merseyside derby, and North London derby?', ARRAY['Emmanuel Adebayor', 'Nicolas Anelka', 'Alexis Sánchez', 'Robin van Persie'], 'Emmanuel Adebayor', 'Emmanuel Adebayor scored for Arsenal, Tottenham, and Manchester City, achieving this unique derby scoring record.'),
('football', 'Which country won the first-ever FIFA World Cup in 1930?', ARRAY['Uruguay', 'Argentina', 'Brazil', 'Italy'], 'Uruguay', 'Uruguay won the inaugural FIFA World Cup in 1930, defeating Argentina 4-2 in the final in Montevideo.'),

-- CHEMISTRY
('chemistry', 'What is the only metal that is liquid at standard temperature and pressure?', ARRAY['Mercury', 'Gallium', 'Bromine', 'Cesium'], 'Mercury', 'Mercury is the only metallic element that is liquid at standard conditions for temperature and pressure (Bromine is also liquid, but is a nonmetal).'),
('chemistry', 'Which element has the highest electrical conductivity of all metals?', ARRAY['Silver', 'Copper', 'Gold', 'Aluminum'], 'Silver', 'Silver has the highest electrical conductivity of any element, followed by copper and gold.'),

-- PHYSICS
('physics', 'Which scientist was awarded the 1921 Nobel Prize in Physics for his explanation of the photoelectric effect?', ARRAY['Albert Einstein', 'Max Planck', 'Niels Bohr', 'Werner Heisenberg'], 'Albert Einstein', 'Albert Einstein received the 1921 Nobel Prize in Physics for his services to Theoretical Physics, and especially for his discovery of the law of the photoelectric effect.'),
('physics', 'What type of subatomic particle is an electron classified as?', ARRAY['Lepton', 'Quark', 'Baryon', 'Boson'], 'Lepton', 'An electron is an elementary particle belonging to the lepton family (spin-1/2 fermions with no strong interactions).'),

-- MATHS
('maths', 'What is the derivative of $e^5x$ with respect to $x$?', ARRAY['$5 \cdot e^{5x}$', '$e^{5x}$', '$\frac{e^{5x}}{5}$', '$5x \cdot e^{5x-1}$'], '$5 \cdot e^{5x}$', 'Using the chain rule, the derivative of $e^{5x}$ is $5 \cdot e^{5x}$.'),
('maths', 'In geometry, how many faces does a regular dodecahedron have?', ARRAY['12', '20', '8', '10'], '12', 'A regular dodecahedron is a 3D platonic solid with 12 pentagonal faces.'),

-- ENGLISH LANGUAGE / VOCAB
('english_language', 'Which grammatical term refers to a word that is spelled the same as another word but has a different meaning?', ARRAY['Homograph', 'Homophone', 'Antonym', 'Acronym'], 'Homograph', 'A homograph is a word that shares the same written form as another word but has a different meaning (e.g. lead/lead or wind/wind).'),
('english_language', 'What is the meaning of the idiom "spill the beans"?', ARRAY['Reveal a secret', 'Make a mistake', 'Create a mess', 'Share food'], 'Reveal a secret', 'The idiom "spill the beans" is a colloquial phrase meaning to prematurely reveal a secret or confidential information.');

-- Enable Row Level Security (RLS) to secure the table
ALTER TABLE wordup_handcrafted_questions ENABLE ROW LEVEL SECURITY;

