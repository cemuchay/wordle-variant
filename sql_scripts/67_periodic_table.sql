-- BATCH 1: BASE DATA (Your 20 Sample Inserts)
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

-- BATCH 2: NOBLE GASES, HALOGENS & NONMETALS (Expansion)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Neon',      '{"symbol":"Ne","number":10,"group":"Noble Gas"}',            1, ARRAY['noble-gas']),
('element_arena', 'Argon',     '{"symbol":"Ar","number":18,"group":"Noble Gas"}',            2, ARRAY['noble-gas']),
('element_arena', 'Krypton',   '{"symbol":"Kr","number":36,"group":"Noble Gas"}',            3, ARRAY['noble-gas']),
('element_arena', 'Radon',     '{"symbol":"Rn","number":86,"group":"Noble Gas"}',            4, ARRAY['noble-gas','radioactive']),
('element_arena', 'Fluorine',  '{"symbol":"F","number":9,"group":"Halogen"}',                2, ARRAY['halogen']),
('element_arena', 'Bromine',   '{"symbol":"Br","number":35,"group":"Halogen"}',              3, ARRAY['halogen','liquid']),
('element_arena', 'Iodine',    '{"symbol":"I","number":53,"group":"Halogen"}',               2, ARRAY['halogen']),
('element_arena', 'Astatine',  '{"symbol":"At","number":85,"group":"Halogen"}',              5, ARRAY['halogen','radioactive']),
('element_arena', 'Sulfur',    '{"symbol":"S","number":16,"group":"Nonmetal"}',              1, ARRAY['nonmetal']),
('element_arena', 'Phosphorus','{"symbol":"P","number":15,"group":"Nonmetal"}',              2, ARRAY['nonmetal']),
('element_arena', 'Selenium',  '{"symbol":"Se","number":34,"group":"Nonmetal"}',             3, ARRAY['nonmetal']);

-- BATCH 3: ALKALI & ALKALINE EARTH METALS (Highly reactive groups)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Lithium',   '{"symbol":"Li","number":3,"group":"Alkali Metal"}',          1, ARRAY['metal']),
('element_arena', 'Potassium', '{"symbol":"K","number":19,"group":"Alkali Metal"}',          2, ARRAY['metal']),
('element_arena', 'Rubidium',  '{"symbol":"Rb","number":37,"group":"Alkali Metal"}',         3, ARRAY['metal']),
('element_arena', 'Cesium',    '{"symbol":"Cs","number":55,"group":"Alkali Metal"}',         4, ARRAY['metal']),
('element_arena', 'Francium',  '{"symbol":"Fr","number":87,"group":"Alkali Metal"}',         5, ARRAY['metal','radioactive']),
('element_arena', 'Magnesium', '{"symbol":"Mg","number":12,"group":"Alkaline Earth Metal"}', 1, ARRAY['metal']),
('element_arena', 'Beryllium', '{"symbol":"Be","number":4,"group":"Alkaline Earth Metal"}',  3, ARRAY['metal']),
('element_arena', 'Strontium', '{"symbol":"Sr","number":38,"group":"Alkaline Earth Metal"}', 3, ARRAY['metal']),
('element_arena', 'Barium',    '{"symbol":"Ba","number":56,"group":"Alkaline Earth Metal"}', 3, ARRAY['metal']),
('element_arena', 'Radium',    '{"symbol":"Ra","number":88,"group":"Alkaline Earth Metal"}', 4, ARRAY['metal','radioactive']);

-- BATCH 4: TRANSITION METALS (Heavy structural & precious metals)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Titanium',  '{"symbol":"Ti","number":22,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Chromium',  '{"symbol":"Cr","number":24,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Manganese', '{"symbol":"Mn","number":25,"group":"Transition Metal"}',     3, ARRAY['metal']),
('element_arena', 'Cobalt',    '{"symbol":"Co","number":27,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Nickel',    '{"symbol":"Ni","number":28,"group":"Transition Metal"}',     2, ARRAY['metal']),
('element_arena', 'Zinc',      '{"symbol":"Zn","number":30,"group":"Transition Metal"}',     1, ARRAY['metal']),
('element_arena', 'Zirconium', '{"symbol":"Zr","number":40,"group":"Transition Metal"}',     3, ARRAY['metal']),
('element_arena', 'Palladium', '{"symbol":"Pd","number":46,"group":"Transition Metal"}',     4, ARRAY['metal','precious']),
('element_arena', 'Cadmium',   '{"symbol":"Cd","number":48,"group":"Transition Metal"}',     3, ARRAY['metal']),
('element_arena', 'Osmium',    '{"symbol":"Os","number":76,"group":"Transition Metal"}',     4, ARRAY['metal']),
('element_arena', 'Iridium',   '{"symbol":"Ir","number":77,"group":"Transition Metal"}',     4, ARRAY['metal','precious']),
('element_arena', 'Vanadium',  '{"symbol":"V","number":23,"group":"Transition Metal"}',      3, ARRAY['metal']),
('element_arena', 'Molybdenum','{"symbol":"Mo","number":42,"group":"Transition Metal"}',     3, ARRAY['metal']),
('element_arena', 'Technetium','{"symbol":"Tc","number":43,"group":"Transition Metal"}',     5, ARRAY['metal','radioactive']),
('element_arena', 'Ruthenium', '{"symbol":"Ru","number":44,"group":"Transition Metal"}',     4, ARRAY['metal']),
('element_arena', 'Rhodium',   '{"symbol":"Rh","number":45,"group":"Transition Metal"}',     4, ARRAY['metal','precious']),
('element_arena', 'Tantalum',  '{"symbol":"Ta","number":73,"group":"Transition Metal"}',     4, ARRAY['metal']),
('element_arena', 'Rhenium',   '{"symbol":"Re","number":75,"group":"Transition Metal"}',     5, ARRAY['metal']),
('element_arena', 'Scandium',  '{"symbol":"Sc","number":21,"group":"Transition Metal"}',     4, ARRAY['metal']),
('element_arena', 'Yttrium',   '{"symbol":"Y","number":39,"group":"Transition Metal"}',      4, ARRAY['metal']),
('element_arena', 'Niobium',   '{"symbol":"Nb","number":41,"group":"Transition Metal"}',     4, ARRAY['metal']),
('element_arena', 'Hafnium',   '{"symbol":"Hf","number":72,"group":"Transition Metal"}',     4, ARRAY['metal']);

-- BATCH 5: METALLOIDS & POST-TRANSITION METALS
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Boron',     '{"symbol":"B","number":5,"group":"Metalloid"}',              2, ARRAY['metalloid']),
('element_arena', 'Germanium', '{"symbol":"Ge","number":32,"group":"Metalloid"}',            3, ARRAY['metalloid']),
('element_arena', 'Arsenic',   '{"symbol":"As","number":33,"group":"Metalloid"}',            2, ARRAY['metalloid']),
('element_arena', 'Antimony',  '{"symbol":"Sb","number":51,"group":"Metalloid"}',            3, ARRAY['metalloid']),
('element_arena', 'Tellurium', '{"symbol":"Te","number":52,"group":"Metalloid"}',            4, ARRAY['metalloid']),
('element_arena', 'Polonium',  '{"symbol":"Po","number":84,"group":"Metalloid"}',            4, ARRAY['metalloid','radioactive']),
('element_arena', 'Tin',       '{"symbol":"Sn","number":50,"group":"Post-Transition Metal"}',2, ARRAY['metal']),
('element_arena', 'Bismuth',   '{"symbol":"Bi","number":83,"group":"Post-Transition Metal"}',3, ARRAY['metal']),
('element_arena', 'Gallium',   '{"symbol":"Ga","number":31,"group":"Post-Transition Metal"}',3, ARRAY['metal']),
('element_arena', 'Indium',    '{"symbol":"In","number":49,"group":"Post-Transition Metal"}',4, ARRAY['metal']),
('element_arena', 'Thallium',  '{"symbol":"Tl","number":81,"group":"Post-Transition Metal"}',4, ARRAY['metal']);

-- BATCH 6: LANTHANIDES & ACTINIDES (Rare earth / Heavy radioactive)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Lanthanum', '{"symbol":"La","number":57,"group":"Lanthanide"}',           3, ARRAY['metal']),
('element_arena', 'Cerium',    '{"symbol":"Ce","number":58,"group":"Lanthanide"}',           4, ARRAY['metal']),
('element_arena', 'Praseodymium','{"symbol":"Pr","number":59,"group":"Lanthanide"}',         5, ARRAY['metal']),
('element_arena', 'Neodymium', '{"symbol":"Nd","number":60,"group":"Lanthanide"}',           3, ARRAY['metal']),
('element_arena', 'Samarium',  '{"symbol":"Sm","number":62,"group":"Lanthanide"}',           4, ARRAY['metal']),
('element_arena', 'Europium',  '{"symbol":"Eu","number":63,"group":"Lanthanide"}',           4, ARRAY['metal']),
('element_arena', 'Gadolinium','{"symbol":"Gd","number":64,"group":"Lanthanide"}',           4, ARRAY['metal']),
('element_arena', 'Terbium',   '{"symbol":"Tb","number":65,"group":"Lanthanide"}',           5, ARRAY['metal']),
('element_arena', 'Dysprosium','{"symbol":"Dy","number":66,"group":"Lanthanide"}',           4, ARRAY['metal']),
('element_arena', 'Holmium',   '{"symbol":"Ho","number":67,"group":"Lanthanide"}',           5, ARRAY['metal']),
('element_arena', 'Erbium',    '{"symbol":"Er","number":68,"group":"Lanthanide"}',           5, ARRAY['metal']),
('element_arena', 'Thulium',   '{"symbol":"Tm","number":69,"group":"Lanthanide"}',           5, ARRAY['metal']),
('element_arena', 'Ytterbium', '{"symbol":"Yb","number":70,"group":"Lanthanide"}',           5, ARRAY['metal']),
('element_arena', 'Lutetium',  '{"symbol":"Lu","number":71,"group":"Lanthanide"}',           5, ARRAY['metal']),
('element_arena', 'Thorium',   '{"symbol":"Th","number":90,"group":"Actinide"}',             3, ARRAY['radioactive']),
('element_arena', 'Plutonium', '{"symbol":"Pu","number":94,"group":"Actinide"}',             4, ARRAY['radioactive']),
('element_arena', 'Americium', '{"symbol":"Am","number":95,"group":"Actinide"}',             4, ARRAY['radioactive']),
('element_arena', 'Curium',    '{"symbol":"Cm","number":96,"group":"Actinide"}',             5, ARRAY['radioactive']);

-- BATCH 7: SUPERHEAVY SYNTHETIC ELEMENTS (Expert Tier 5)
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('element_arena', 'Oganesson', '{"symbol":"Og","number":118,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Tennessine','{"symbol":"Ts","number":117,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Livermorium','{"symbol":"Lv","number":116,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Moscovium', '{"symbol":"Mc","number":115,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Flerovium', '{"symbol":"Fl","number":114,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Nihonium',  '{"symbol":"Nh","number":113,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Copernicium','{"symbol":"Cn","number":112,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Roentgenium','{"symbol":"Rg","number":111,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Darmstadtium','{"symbol":"Ds","number":110,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Meitnerium','{"symbol":"Mt","number":109,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Hassium',   '{"symbol":"Hs","number":108,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Bohrium',   '{"symbol":"Bh","number":107,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Seaborgium','{"symbol":"Sg","number":106,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Dubnium',   '{"symbol":"Db","number":105,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
('element_arena', 'Rutherfordium','{"symbol":"Rf","number":104,"group":"Superheavy"}',       5, ARRAY['synthetic','radioactive']),
('element_arena', 'Lawrencium','{"symbol":"Lr","number":103,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']),
('element_arena', 'Nobelium',  '{"symbol":"No","number":102,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']),
('element_arena', 'Mendelevium','{"symbol":"Md","number":101,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']),
('element_arena', 'Fermium',   '{"symbol":"Fm","number":100,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']);