-- Up migration: Adding 30 more unique country entities to wordup_entities

-- AFRICA (Expanded pool for regional distractors)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'South Africa',  '{"country":"South Africa","continent":"Africa"}', 2, ARRAY['africa']),
('capitals_clash', 'Morocco',       '{"country":"Morocco","continent":"Africa"}',      2, ARRAY['africa']),
('capitals_clash', 'Ghana',         '{"country":"Ghana","continent":"Africa"}',        2, ARRAY['africa']),
('capitals_clash', 'Ethiopia',      '{"country":"Ethiopia","continent":"Africa"}',     3, ARRAY['africa']),
('capitals_clash', 'Madagascar',    '{"country":"Madagascar","continent":"Africa"}',   4, ARRAY['africa']),
('capitals_clash', 'Senegal',       '{"country":"Senegal","continent":"Africa"}',      3, ARRAY['africa']);

-- ASIA & MIDDLE EAST (Expanded pool)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Bangkok',       '{"country":"Thailand","continent":"Asia"}',       2, ARRAY['asia']),
('capitals_clash', 'Singapore',     '{"country":"Singapore","continent":"Asia"}',      2, ARRAY['asia']),
('capitals_clash', 'Hanoi',         '{"country":"Vietnam","continent":"Asia"}',        3, ARRAY['asia']),
('capitals_clash', 'Jakarta',       '{"country":"Indonesia","continent":"Asia"}',      3, ARRAY['asia']),
('capitals_clash', 'Manila',        '{"country":"Philippines","continent":"Asia"}',    3, ARRAY['asia']),
('capitals_clash', 'Tehran',        '{"country":"Iran","continent":"Asia"}',           3, ARRAY['asia']),
('capitals_clash', 'Baghdad',       '{"country":"Iraq","continent":"Asia"}',           3, ARRAY['asia']);

-- EUROPE (Mid to Advanced difficulty additions)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Athens',        '{"country":"Greece","continent":"Europe"}',       2, ARRAY['europe']),
('capitals_clash', 'Lisbon',        '{"country":"Portugal","continent":"Europe"}',     2, ARRAY['europe']),
('capitals_clash', 'Dublin',        '{"country":"Ireland","continent":"Europe"}',      2, ARRAY['europe']),
('capitals_clash', 'Vienna',        '{"country":"Austria","continent":"Europe"}',      2, ARRAY['europe']),
('capitals_clash', 'Warsaw',        '{"country":"Poland","continent":"Europe"}',       2, ARRAY['europe']),
('capitals_clash', 'Brussels',      '{"country":"Belgium","continent":"Europe"}',     2, ARRAY['europe']),
('capitals_clash', 'Stockholm',     '{"country":"Sweden","continent":"Europe"}',       2, ARRAY['europe']),
('capitals_clash', 'Oslo',          '{"country":"Norway","continent":"Europe"}',       2, ARRAY['europe']),
('capitals_clash', 'Helsinki',      '{"country":"Finland","continent":"Europe"}',      3, ARRAY['europe']),
('capitals_clash', 'Copenhagen',    '{"country":"Denmark","continent":"Europe"}',      3, ARRAY['europe']);

-- AMERICAS & OCEANIA (Geographic diversity balancing)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Mexico City',   '{"country":"Mexico","continent":"North America"}',1, ARRAY['north-america']),
('capitals_clash', 'Havana',        '{"country":"Cuba","continent":"North America"}',  3, ARRAY['caribbean']),
('capitals_clash', 'Santiago',      '{"country":"Chile","continent":"South America"}', 3, ARRAY['south-america']),
('capitals_clash', 'Bogota',        '{"country":"Colombia","continent":"South America"}', 3, ARRAY['south-america']),
('capitals_clash', 'Lima',          '{"country":"Peru","continent":"South America"}',   3, ARRAY['south-america']),
('capitals_clash', 'Wellington',    '{"country":"New Zealand","continent":"Oceania"}', 2, ARRAY['oceania']),
('capitals_clash', 'Suva',          '{"country":"Fiji","continent":"Oceania"}',        4, ARRAY['oceania']);

-- Up migration: Adding another 30 unique country entities to wordup_entities

-- ASIA & MIDDLE EAST (Advanced Tiers)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Kuala Lumpur',  '{"country":"Malaysia","continent":"Asia"}',       2, ARRAY['asia']),
('capitals_clash', 'Phnom Penh',    '{"country":"Cambodia","continent":"Asia"}',       3, ARRAY['asia']),
('capitals_clash', 'Kathmandu',     '{"country":"Nepal","continent":"Asia"}',          3, ARRAY['asia']),
('capitals_clash', 'Dhaka',         '{"country":"Bangladesh","continent":"Asia"}',     3, ARRAY['asia']),
('capitals_clash', 'Amman',         '{"country":"Jordan","continent":"Middle East"}',  3, ARRAY['asia']),
('capitals_clash', 'Muscat',        '{"country":"Oman","continent":"Middle East"}',    4, ARRAY['asia']),
('capitals_clash', 'Beirut',        '{"country":"Lebanon","continent":"Middle East"}', 3, ARRAY['asia']);

-- EUROPE (Eastern & Baltic Additions)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Prague',        '{"country":"Czech Republic","continent":"Europe"}',2, ARRAY['europe']),
('capitals_clash', 'Budapest',      '{"country":"Hungary","continent":"Europe"}',      2, ARRAY['europe']),
('capitals_clash', 'Bucharest',     '{"country":"Romania","continent":"Europe"}',      3, ARRAY['europe']),
('capitals_clash', 'Zagreb',        '{"country":"Croatia","continent":"Europe"}',      3, ARRAY['europe']),
('capitals_clash', 'Bratislava',    '{"country":"Slovakia","continent":"Europe"}',     3, ARRAY['europe']),
('capitals_clash', 'Tallinn',       '{"country":"Estonia","continent":"Europe"}',      4, ARRAY['europe']),
('capitals_clash', 'Riga',          '{"country":"Latvia","continent":"Europe"}',       4, ARRAY['europe']),
('capitals_clash', 'Vilnius',       '{"country":"Lithuania","continent":"Europe"}',    4, ARRAY['europe']);

-- AFRICA (Central, Northern & Island States)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Tunis',         '{"country":"Tunisia","continent":"Africa"}',      2, ARRAY['africa']),
('capitals_clash', 'Luanda',        '{"country":"Angola","continent":"Africa"}',       3, ARRAY['africa']),
('capitals_clash', 'Dar es Salaam', '{"country":"Tanzania","continent":"Africa"}',     3, ARRAY['africa']),
('capitals_clash', 'Harare',        '{"country":"Zimbabwe","continent":"Africa"}',     3, ARRAY['africa']),
('capitals_clash', 'Dakar',         '{"country":"Senegal","continent":"Africa"}',      3, ARRAY['africa']),
('capitals_clash', 'Kigali',        '{"country":"Rwanda","continent":"Africa"}',       4, ARRAY['africa']),
('capitals_clash', 'Port Louis',    '{"country":"Mauritius","continent":"Africa"}',    4, ARRAY['africa']);

-- AMERICAS & CARIBBEAN (Deep Cut Geography)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Caracas',       '{"country":"Venezuela","continent":"South America"}',2, ARRAY['south-america']),
('capitals_clash', 'Montevideo',    '{"country":"Uruguay","continent":"South America"}',  3, ARRAY['south-america']),
('capitals_clash', 'Quito',         '{"country":"Ecuador","continent":"South America"}',  3, ARRAY['south-america']),
('capitals_clash', 'San Jose',      '{"country":"Costa Rica","continent":"Central America"}',3, ARRAY['north-america']),
('capitals_clash', 'Kingston',      '{"country":"Jamaica","continent":"Caribbean"}',   2, ARRAY['north-america']),
('capitals_clash', 'Nassau',        '{"country":"Bahamas","continent":"Caribbean"}',   3, ARRAY['north-america']);

-- OCEANIA (Expert Tier)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Port Moresby',  '{"country":"Papua New Guinea","continent":"Oceania"}',3, ARRAY['oceania']),
('capitals_clash', 'Apia',          '{"country":"Samoa","continent":"Oceania"}',       5, ARRAY['oceania']);

-- Up migration: Final 20 unique country entities to reach 100 total records

-- ASIA & MIDDLE EAST (Microstates & Deep Cuts)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Doha',          '{"country":"Qatar","continent":"Middle East"}',     2, ARRAY['asia']),
('capitals_clash', 'Abu Dhabi',     '{"country":"United Arab Emirates","continent":"Middle East"}', 2, ARRAY['asia']),
('capitals_clash', 'Male',          '{"country":"Maldives","continent":"Asia"}',         4, ARRAY['asia']),
('capitals_clash', 'Thimphu',       '{"country":"Bhutan","continent":"Asia"}',           4, ARRAY['asia']),
('capitals_clash', 'Nicosia',       '{"country":"Cyprus","continent":"Middle East"}',    3, ARRAY['asia', 'europe']);

-- EUROPE (Sovereign Enclaves & Mediterranean)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Valletta',      '{"country":"Malta","continent":"Europe"}',          3, ARRAY['europe']),
('capitals_clash', 'Luxembourg',    '{"country":"Luxembourg","continent":"Europe"}',     3, ARRAY['europe']),
('capitals_clash', 'Monaco',        '{"country":"Monaco","continent":"Europe"}',         4, ARRAY['europe']),
('capitals_clash', 'San Marino',    '{"country":"San Marino","continent":"Europe"}',     4, ARRAY['europe']),
('capitals_clash', 'Vaduz',         '{"country":"Liechtenstein","continent":"Europe"}',  5, ARRAY['europe']),
('capitals_clash', 'Andorra la Vella','{"country":"Andorra","continent":"Europe"}',      4, ARRAY['europe']);

-- AFRICA (Lesser-Known Regional Capitals)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Maputo',        '{"country":"Mozambique","continent":"Africa"}',     3, ARRAY['africa']),
('capitals_clash', 'Antananarivo',  '{"country":"Madagascar","continent":"Africa"}',     4, ARRAY['africa']),
('capitals_clash', 'Windhoek',      '{"country":"Namibia","continent":"Africa"}',        4, ARRAY['africa']),
('capitals_clash', 'Gaborone',      '{"country":"Botswana","continent":"Africa"}',       4, ARRAY['africa']),
('capitals_clash', 'Asmara',        '{"country":"Eritrea","continent":"Africa"}',        5, ARRAY['africa']);

-- AMERICAS & OCEANIA (Pacific & Atlantic Outliers)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('capitals_clash', 'Asuncion',      '{"country":"Paraguay","continent":"South America"}',3, ARRAY['south-america']),
('capitals_clash', 'La Paz',        '{"country":"Bolivia","continent":"South America"}', 3, ARRAY['south-america']),
('capitals_clash', 'Honiara',       '{"country":"Solomon Islands","continent":"Oceania"}',5, ARRAY['oceania']),
('capitals_clash', 'Nuku''alofa',   '{"country":"Tonga","continent":"Oceania"}',         5, ARRAY['oceania']);