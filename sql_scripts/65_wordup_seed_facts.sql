-- Seed data for wordup_entities — procedural knowledge categories
-- Each row is a fact entity the edge function uses to generate questions.
-- Run after 64_wordup_entities.sql has been applied.

-- ────────────────────────────────────────────────────────────
-- TIER 1 (launch-ready, rich entity data)
-- ────────────────────────────────────────────────────────────

-- 1. CAPITAL CITIES (capitals_clash)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Paris',          '{"country":"France","continent":"Europe"}',        1, ARRAY['europe']),
('capitals_clash', 'London',         '{"country":"United Kingdom","continent":"Europe"}', 1, ARRAY['europe']),
('capitals_clash', 'Berlin',         '{"country":"Germany","continent":"Europe"}',        1, ARRAY['europe']),
('capitals_clash', 'Rome',           '{"country":"Italy","continent":"Europe"}',          1, ARRAY['europe']),
('capitals_clash', 'Madrid',         '{"country":"Spain","continent":"Europe"}',          1, ARRAY['europe']),
('capitals_clash', 'Moscow',         '{"country":"Russia","continent":"Europe"}',          2, ARRAY['europe']),
('capitals_clash', 'Tokyo',          '{"country":"Japan","continent":"Asia"}',            2, ARRAY['asia']),
('capitals_clash', 'Beijing',        '{"country":"China","continent":"Asia"}',            2, ARRAY['asia']),
('capitals_clash', 'New Delhi',      '{"country":"India","continent":"Asia"}',            2, ARRAY['asia']),
('capitals_clash', 'Seoul',          '{"country":"South Korea","continent":"Asia"}',      2, ARRAY['asia']),
('capitals_clash', 'Ottawa',         '{"country":"Canada","continent":"North America"}',  2, ARRAY['north-america']),
('capitals_clash', 'Washington D.C.','{"country":"United States","continent":"North America"}', 2, ARRAY['north-america']),
('capitals_clash', 'Brasilia',       '{"country":"Brazil","continent":"South America"}',  3, ARRAY['south-america']),
('capitals_clash', 'Buenos Aires',   '{"country":"Argentina","continent":"South America"}',3, ARRAY['south-america']),
('capitals_clash', 'Canberra',       '{"country":"Australia","continent":"Oceania"}',      3, ARRAY['oceania']),
('capitals_clash', 'Cairo',          '{"country":"Egypt","continent":"Africa"}',           3, ARRAY['africa']),
('capitals_clash', 'Nairobi',        '{"country":"Kenya","continent":"Africa"}',           3, ARRAY['africa']),
('capitals_clash', 'Abuja',          '{"country":"Nigeria","continent":"Africa"}',         3, ARRAY['africa']),
('capitals_clash', 'Reykjavik',      '{"country":"Iceland","continent":"Europe"}',         4, ARRAY['europe']),
('capitals_clash', 'Ulaanbaatar',    '{"country":"Mongolia","continent":"Asia"}',          5, ARRAY['asia']);

-- 2. CURRENCIES (currency_exchange)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('currency_exchange', 'US Dollar',      '{"code":"USD","symbol":"$","country":"United States"}',  1, ARRAY['major']),
('currency_exchange', 'Euro',           '{"code":"EUR","symbol":"€","country":"Eurozone"}',       1, ARRAY['major']),
('currency_exchange', 'British Pound',  '{"code":"GBP","symbol":"£","country":"United Kingdom"}', 1, ARRAY['major']),
('currency_exchange', 'Japanese Yen',   '{"code":"JPY","symbol":"¥","country":"Japan"}',          1, ARRAY['major']),
('currency_exchange', 'Nigerian Naira', '{"code":"NGN","symbol":"₦","country":"Nigeria"}',        2, ARRAY['africa']),
('currency_exchange', 'South African Rand', '{"code":"ZAR","symbol":"R","country":"South Africa"}', 2, ARRAY['africa']),
('currency_exchange', 'Indian Rupee',   '{"code":"INR","symbol":"₹","country":"India"}',          2, ARRAY['asia']),
('currency_exchange', 'Chinese Yuan',   '{"code":"CNY","symbol":"¥","country":"China"}',          2, ARRAY['asia']),
('currency_exchange', 'Canadian Dollar','{"code":"CAD","symbol":"$","country":"Canada"}',         2, ARRAY['major']),
('currency_exchange', 'Australian Dollar','{"code":"AUD","symbol":"$","country":"Australia"}',    2, ARRAY['major']),
('currency_exchange', 'Swiss Franc',    '{"code":"CHF","symbol":"Fr","country":"Switzerland"}',   3, ARRAY['europe']),
('currency_exchange', 'Ghanaian Cedi',  '{"code":"GHS","symbol":"₵","country":"Ghana"}',          3, ARRAY['africa']),
('currency_exchange', 'Kenyan Shilling','{"code":"KES","symbol":"KSh","country":"Kenya"}',        3, ARRAY['africa']),
('currency_exchange', 'Mexican Peso',   '{"code":"MXN","symbol":"$","country":"Mexico"}',         3, ARRAY['americas']),
('currency_exchange', 'Brazilian Real', '{"code":"BRL","symbol":"R$","country":"Brazil"}',        3, ARRAY['americas']),
('currency_exchange', 'Saudi Riyal',    '{"code":"SAR","symbol":"﷼","country":"Saudi Arabia"}',   4, ARRAY['middle-east']),
('currency_exchange', 'Turkish Lira',   '{"code":"TRY","symbol":"₺","country":"Turkey"}',         4, ARRAY['europe']),
('currency_exchange', 'Thai Baht',      '{"code":"THB","symbol":"฿","country":"Thailand"}',       4, ARRAY['asia']),
('currency_exchange', 'Icelandic Krona','{"code":"ISK","symbol":"kr","country":"Iceland"}',       5, ARRAY['europe']),
('currency_exchange', 'Zambian Kwacha', '{"code":"ZMW","symbol":"ZK","country":"Zambia"}',        5, ARRAY['africa']);

-- 3. FLAGS (flag_bearer)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('flag_bearer', 'Nigeria',        '{"colors":"Green, White, Green","stripes":3,"continent":"Africa"}',           1, ARRAY['africa']),
('flag_bearer', 'France',         '{"colors":"Blue, White, Red","stripes":3,"continent":"Europe"}',              1, ARRAY['europe']),
('flag_bearer', 'Japan',          '{"colors":"White, Red","stripes":0,"continent":"Asia"}',                      1, ARRAY['asia']),
('flag_bearer', 'United States',  '{"colors":"Red, White, Blue","stripes":13,"continent":"North America"}',      2, ARRAY['north-america']),
('flag_bearer', 'Brazil',         '{"colors":"Green, Yellow, Blue, White","stripes":0,"continent":"South America"}', 2, ARRAY['south-america']),
('flag_bearer', 'India',          '{"colors":"Saffron, White, Green","stripes":3,"continent":"Asia"}',           2, ARRAY['asia']),
('flag_bearer', 'United Kingdom', '{"colors":"Red, White, Blue","stripes":0,"continent":"Europe"}',              2, ARRAY['europe']),
('flag_bearer', 'Germany',        '{"colors":"Black, Red, Gold","stripes":3,"continent":"Europe"}',              2, ARRAY['europe']),
('flag_bearer', 'South Africa',   '{"colors":"Black, Green, Yellow, White, Red, Blue","stripes":0,"continent":"Africa"}', 3, ARRAY['africa']),
('flag_bearer', 'Canada',         '{"colors":"Red, White","stripes":0,"continent":"North America"}',             2, ARRAY['north-america']),
('flag_bearer', 'Australia',      '{"colors":"Blue, Red, White","stripes":0,"continent":"Oceania"}',             3, ARRAY['oceania']),
('flag_bearer', 'China',          '{"colors":"Red, Yellow","stripes":0,"continent":"Asia"}',                     2, ARRAY['asia']),
('flag_bearer', 'Italy',          '{"colors":"Green, White, Red","stripes":3,"continent":"Europe"}',             1, ARRAY['europe']),
('flag_bearer', 'Argentina',      '{"colors":"Light Blue, White","stripes":3,"continent":"South America"}',      3, ARRAY['south-america']),
('flag_bearer', 'Switzerland',    '{"colors":"Red, White","stripes":0,"continent":"Europe"}',                    3, ARRAY['europe']),
('flag_bearer', 'Jamaica',        '{"colors":"Black, Green, Yellow","stripes":0,"continent":"North America"}',   3, ARRAY['north-america']),
('flag_bearer', 'Ghana',          '{"colors":"Red, Yellow, Green, Black","stripes":3,"continent":"Africa"}',     2, ARRAY['africa']),
('flag_bearer', 'Russia',         '{"colors":"White, Blue, Red","stripes":3,"continent":"Europe"}',              2, ARRAY['europe']),
('flag_bearer', 'Kenya',          '{"colors":"Black, Red, Green, White","stripes":0,"continent":"Africa"}',      3, ARRAY['africa']),
('flag_bearer', 'South Korea',    '{"colors":"White, Red, Blue, Black","stripes":0,"continent":"Asia"}',         3, ARRAY['asia']);

-- 4. PERIODIC TABLE (element_arena)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Hydrogen',  '{"symbol":"H","number":1,"group":"Nonmetal"}',               1, ARRAY['nonmetal']),
('element_arena', 'Helium',    '{"symbol":"He","number":2,"group":"Noble Gas"}',             1, ARRAY['noble-gas']),
('element_arena', 'Carbon',    '{"symbol":"C","number":6,"group":"Nonmetal"}',               1, ARRAY['nonmetal']),
('element_arena', 'Oxygen',    '{"symbol":"O","number":8,"group":"Nonmetal"}',               1, ARRAY['nonmetal']),
('element_arena', 'Iron',      '{"symbol":"Fe","number":26,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Gold',      '{"symbol":"Au","number":79,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Silver',    '{"symbol":"Ag","number":47,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Sodium',    '{"symbol":"Na","number":11,"group":"Alkali Metal"}',         2, ARRAY['metal']),
('element_arena', 'Chlorine',  '{"symbol":"Cl","number":17,"group":"Halogen"}',              2, ARRAY['halogen']),
('element_arena', 'Nitrogen',  '{"symbol":"N","number":7,"group":"Nonmetal"}',               2, ARRAY['nonmetal']),
('element_arena', 'Uranium',   '{"symbol":"U","number":92,"group":"Actinide"}',              3, ARRAY['radioactive']),
('element_arena', 'Mercury',   '{"symbol":"Hg","number":80,"group":"Transition Metal"}',     3, ARRAY['metal','liquid']),
('element_arena', 'Copper',    '{"symbol":"Cu","number":29,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Aluminum',  '{"symbol":"Al","number":13,"group":"Post-Transition Metal"}', 2, ARRAY['metal']),
('element_arena', 'Calcium',   '{"symbol":"Ca","number":20,"group":"Alkaline Earth Metal"}', 2, ARRAY['metal']),
('element_arena', 'Lead',      '{"symbol":"Pb","number":82,"group":"Post-Transition Metal"}', 3, ARRAY['metal']),
('element_arena', 'Platinum',  '{"symbol":"Pt","number":78,"group":"Transition Metal"}',     3, ARRAY['metal','precious']),
('element_arena', 'Silicon',   '{"symbol":"Si","number":14,"group":"Metalloid"}',            2, ARRAY['metalloid']),
('element_arena', 'Xenon',     '{"symbol":"Xe","number":54,"group":"Noble Gas"}',            4, ARRAY['noble-gas']),
('element_arena', 'Tungsten',  '{"symbol":"W","number":74,"group":"Transition Metal"}',      4, ARRAY['metal']);

-- 5. ANIMAL KINGDOM (animal_kingdom)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('animal_kingdom', 'Lion',              '{"class":"Mammal","habitat":"Savanna","diet":"Carnivore"}',        1, ARRAY['big-cat']),
('animal_kingdom', 'Eagle',             '{"class":"Bird","habitat":"Mountains","diet":"Carnivore"}',        1, ARRAY['raptor']),
('animal_kingdom', 'Dolphin',           '{"class":"Mammal","habitat":"Ocean","diet":"Carnivore"}',          1, ARRAY['marine']),
('animal_kingdom', 'Elephant',          '{"class":"Mammal","habitat":"Savanna","diet":"Herbivore"}',        1, ARRAY['large']),
('animal_kingdom', 'Penguin',           '{"class":"Bird","habitat":"Antarctica","diet":"Carnivore"}',       1, ARRAY['flightless']),
('animal_kingdom', 'Kangaroo',          '{"class":"Mammal","habitat":"Australia","diet":"Herbivore"}',      2, ARRAY['marsupial']),
('animal_kingdom', 'Octopus',           '{"class":"Cephalopod","habitat":"Ocean","diet":"Carnivore"}',      2, ARRAY['marine']),
('animal_kingdom', 'Giraffe',           '{"class":"Mammal","habitat":"Savanna","diet":"Herbivore"}',        1, ARRAY['tall']),
('animal_kingdom', 'Crocodile',         '{"class":"Reptile","habitat":"Swamps","diet":"Carnivore"}',        2, ARRAY['reptile']),
('animal_kingdom', 'Butterfly',         '{"class":"Insect","habitat":"Gardens","diet":"Herbivore"}',        1, ARRAY['insect']),
('animal_kingdom', 'Great White Shark', '{"class":"Fish","habitat":"Ocean","diet":"Carnivore"}',            2, ARRAY['marine']),
('animal_kingdom', 'Polar Bear',        '{"class":"Mammal","habitat":"Arctic","diet":"Carnivore"}',         2, ARRAY['bear']),
('animal_kingdom', 'Chimpanzee',        '{"class":"Mammal","habitat":"Jungle","diet":"Omnivore"}',          2, ARRAY['primate']),
('animal_kingdom', 'Komodo Dragon',     '{"class":"Reptile","habitat":"Islands","diet":"Carnivore"}',       3, ARRAY['lizard']),
('animal_kingdom', 'Blue Whale',        '{"class":"Mammal","habitat":"Ocean","diet":"Carnivore"}',          2, ARRAY['marine','large']),
('animal_kingdom', 'Chameleon',         '{"class":"Reptile","habitat":"Rainforest","diet":"Carnivore"}',    2, ARRAY['lizard']),
('animal_kingdom', 'Honey Bee',         '{"class":"Insect","habitat":"Meadows","diet":"Herbivore"}',        1, ARRAY['insect']),
('animal_kingdom', 'Red Fox',           '{"class":"Mammal","habitat":"Forests","diet":"Omnivore"}',         1, ARRAY['canine']),
('animal_kingdom', 'Platypus',          '{"class":"Mammal","habitat":"Australia","diet":"Carnivore"}',      4, ARRAY['monotreme']),
('animal_kingdom', 'Axolotl',           '{"class":"Amphibian","habitat":"Mexico","diet":"Carnivore"}',      4, ARRAY['neotenic']);

-- 6. SPACE & ASTRONOMY (cosmic_frontier)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('cosmic_frontier', 'Mars',                        '{"type":"Planet","distance":"225M km","fact":"The Red Planet"}',                    1, ARRAY['planet']),
('cosmic_frontier', 'Moon',                        '{"type":"Satellite","distance":"384K km","fact":"Earth''s only natural satellite"}',1, ARRAY['satellite']),
('cosmic_frontier', 'Sun',                         '{"type":"Star","distance":"149.6M km","fact":"Our solar system''s star"}',         1, ARRAY['star']),
('cosmic_frontier', 'Saturn',                      '{"type":"Planet","distance":"1.4B km","fact":"Known for its rings"}',              1, ARRAY['planet']),
('cosmic_frontier', 'Andromeda',                   '{"type":"Galaxy","distance":"2.5M ly","fact":"Nearest major galaxy"}',              2, ARRAY['galaxy']),
('cosmic_frontier', 'Neptune',                     '{"type":"Planet","distance":"4.5B km","fact":"The windiest planet"}',              2, ARRAY['planet']),
('cosmic_frontier', 'Venus',                       '{"type":"Planet","distance":"108M km","fact":"Hottest planet"}',                   2, ARRAY['planet']),
('cosmic_frontier', 'Halley''s Comet',             '{"type":"Comet","distance":"varies","fact":"Visible every 75-76 years"}',          2, ARRAY['comet']),
('cosmic_frontier', 'Jupiter',                     '{"type":"Planet","distance":"778M km","fact":"Largest planet"}',                   1, ARRAY['planet']),
('cosmic_frontier', 'Betelgeuse',                  '{"type":"Star","distance":"642 ly","fact":"A red supergiant"}',                    3, ARRAY['star']),
('cosmic_frontier', 'Pluto',                       '{"type":"Dwarf Planet","distance":"5.9B km","fact":"Reclassified in 2006"}',      2, ARRAY['dwarf']),
('cosmic_frontier', 'Milky Way',                   '{"type":"Galaxy","distance":"0 ly","fact":"Our home galaxy"}',                     1, ARRAY['galaxy']),
('cosmic_frontier', 'Titan',                       '{"type":"Satellite","distance":"1.4B km","fact":"Saturn''s largest moon"}',       3, ARRAY['satellite']),
('cosmic_frontier', 'Black Hole',                  '{"type":"Phenomenon","distance":"varies","fact":"Nothing escapes its gravity"}',   2, ARRAY['phenomenon']),
('cosmic_frontier', 'Mercury',                     '{"type":"Planet","distance":"57.9M km","fact":"Smallest planet"}',                2, ARRAY['planet']),
('cosmic_frontier', 'Supernova',                   '{"type":"Phenomenon","distance":"varies","fact":"A star''s explosive death"}',     3, ARRAY['phenomenon']),
('cosmic_frontier', 'International Space Station', '{"type":"Station","distance":"408 km","fact":"Orbiting laboratory"}',              2, ARRAY['human']),
('cosmic_frontier', 'Uranus',                      '{"type":"Planet","distance":"2.9B km","fact":"Rotates on its side"}',              3, ARRAY['planet']),
('cosmic_frontier', 'Proxima Centauri',            '{"type":"Star","distance":"4.24 ly","fact":"Nearest star to the Sun"}',           4, ARRAY['star']),
('cosmic_frontier', 'Pulsar',                      '{"type":"Star","distance":"varies","fact":"A rotating neutron star"}',             5, ARRAY['star']);

-- 7. MOVIES & MEDIA (cinephile_trivia)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('cinephile_trivia', 'The Godfather',                    '{"year":1972,"director":"Francis Ford Coppola","genre":"Crime"}',             1, ARRAY['classic']),
('cinephile_trivia', 'Titanic',                          '{"year":1997,"director":"James Cameron","genre":"Romance"}',                  1, ARRAY['blockbuster']),
('cinephile_trivia', 'Star Wars',                        '{"year":1977,"director":"George Lucas","genre":"Sci-Fi"}',                    1, ARRAY['franchise']),
('cinephile_trivia', 'The Matrix',                       '{"year":1999,"director":"The Wachowskis","genre":"Sci-Fi"}',                  1, ARRAY['cult']),
('cinephile_trivia', 'Jurassic Park',                    '{"year":1993,"director":"Steven Spielberg","genre":"Adventure"}',             1, ARRAY['blockbuster']),
('cinephile_trivia', 'Pulp Fiction',                     '{"year":1994,"director":"Quentin Tarantino","genre":"Crime"}',                2, ARRAY['cult']),
('cinephile_trivia', 'Inception',                        '{"year":2010,"director":"Christopher Nolan","genre":"Sci-Fi"}',               2, ARRAY['mind-bender']),
('cinephile_trivia', 'Forrest Gump',                     '{"year":1994,"director":"Robert Zemeckis","genre":"Drama"}',                  1, ARRAY['classic']),
('cinephile_trivia', 'The Lion King',                    '{"year":1994,"director":"Roger Allers","genre":"Animation"}',                 1, ARRAY['disney']),
('cinephile_trivia', 'Spirited Away',                    '{"year":2001,"director":"Hayao Miyazaki","genre":"Animation"}',               2, ARRAY['anime']),
('cinephile_trivia', 'The Dark Knight',                  '{"year":2008,"director":"Christopher Nolan","genre":"Action"}',               1, ARRAY['superhero']),
('cinephile_trivia', 'Schindler''s List',                '{"year":1993,"director":"Steven Spielberg","genre":"Historical Drama"}',      2, ARRAY['classic']),
('cinephile_trivia', 'Parasite',                         '{"year":2019,"director":"Bong Joon-ho","genre":"Thriller"}',                 2, ARRAY['oscar']),
('cinephile_trivia', 'Avatar',                           '{"year":2009,"director":"James Cameron","genre":"Sci-Fi"}',                   1, ARRAY['blockbuster']),
('cinephile_trivia', 'Casablanca',                       '{"year":1942,"director":"Michael Curtiz","genre":"Romance"}',                 3, ARRAY['classic']),
('cinephile_trivia', 'Interstellar',                     '{"year":2014,"director":"Christopher Nolan","genre":"Sci-Fi"}',               2, ARRAY['space']),
('cinephile_trivia', 'The Wizard of Oz',                 '{"year":1939,"director":"Victor Fleming","genre":"Fantasy"}',                 2, ARRAY['classic']),
('cinephile_trivia', 'Fight Club',                       '{"year":1999,"director":"David Fincher","genre":"Drama"}',                    2, ARRAY['cult']),
('cinephile_trivia', 'Citizen Kane',                     '{"year":1941,"director":"Orson Welles","genre":"Drama"}',                     3, ARRAY['classic']),
('cinephile_trivia', 'Everything Everywhere All at Once','{"year":2022,"director":"Daniels","genre":"Sci-Fi"}',                         3, ARRAY['oscar']);

-- 8. HISTORY ERAS (history_milestones)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('history_milestones', 'World War II',                '{"year":1939,"endYear":1945,"era":"20th Century"}',        1, ARRAY['war']),
('history_milestones', 'The French Revolution',       '{"year":1789,"endYear":1799,"era":"18th Century"}',        2, ARRAY['revolution']),
('history_milestones', 'The Moon Landing',            '{"year":1969,"endYear":1969,"era":"20th Century"}',        1, ARRAY['space']),
('history_milestones', 'The Industrial Revolution',   '{"year":1760,"endYear":1840,"era":"18th Century"}',        2, ARRAY['technology']),
('history_milestones', 'The Fall of the Berlin Wall', '{"year":1989,"endYear":1989,"era":"20th Century"}',        2, ARRAY['cold-war']),
('history_milestones', 'The Renaissance',             '{"year":1300,"endYear":1600,"era":"Medieval"}',            2, ARRAY['culture']),
('history_milestones', 'The American Civil War',      '{"year":1861,"endYear":1865,"era":"19th Century"}',        2, ARRAY['war']),
('history_milestones', 'The Discovery of America',    '{"year":1492,"endYear":1492,"era":"15th Century"}',        1, ARRAY['exploration']),
('history_milestones', 'World War I',                 '{"year":1914,"endYear":1918,"era":"20th Century"}',        1, ARRAY['war']),
('history_milestones', 'The Signing of Magna Carta',  '{"year":1215,"endYear":1215,"era":"Medieval"}',            3, ARRAY['law']),
('history_milestones', 'The Invention of the Internet','{"year":1983,"endYear":1983,"era":"20th Century"}',       2, ARRAY['technology']),
('history_milestones', 'The Ancient Egyptian Pyramids','{"year":-2560,"endYear":-2560,"era":"Ancient"}',          2, ARRAY['ancient']),
('history_milestones', 'The Cold War',                '{"year":1947,"endYear":1991,"era":"20th Century"}',        2, ARRAY['war']),
('history_milestones', 'The Wright Brothers'' Flight', '{"year":1903,"endYear":1903,"era":"20th Century"}',       2, ARRAY['technology']),
('history_milestones', 'The Black Death',             '{"year":1347,"endYear":1351,"era":"Medieval"}',            3, ARRAY['disease']),
('history_milestones', 'The Apollo Program',          '{"year":1961,"endYear":1972,"era":"20th Century"}',        2, ARRAY['space']),
('history_milestones', 'The Fall of the Roman Empire','{"year":476,"endYear":476,"era":"Ancient"}',              3, ARRAY['empire']),
('history_milestones', 'The Manhattan Project',       '{"year":1942,"endYear":1945,"era":"20th Century"}',        3, ARRAY['war','science']),
('history_milestones', 'The Berlin Airlift',          '{"year":1948,"endYear":1949,"era":"20th Century"}',        4, ARRAY['cold-war']),
('history_milestones', 'The Treaty of Westphalia',    '{"year":1648,"endYear":1648,"era":"17th Century"}',        5, ARRAY['diplomacy']);

-- ────────────────────────────────────────────────────────────
-- TIER 2 (algorithmic — no entities needed, but for completeness)
-- ────────────────────────────────────────────────────────────
-- mental_math_blitz  → generates arithmetic questions purely from seeded RNG
-- sequence_solver    → generates number-pattern questions purely from seeded RNG
-- These two categories produce questions without any entity rows.
-- Add entity data here later if you want themed/varied distractors.
