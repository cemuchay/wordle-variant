-- ===================================================================
-- Migration: rename metadata key "number" to "atomic_number"
-- for element_arena (Periodic Table) entities
-- ===================================================================

-- Step 1: Update existing rows — remove old "number" key and
-- insert new "atomic_number" key with the same integer value.
UPDATE wordup_entities
SET metadata = (metadata::jsonb - 'number' || jsonb_build_object('atomic_number', (metadata::jsonb -> 'number')::int))::json
WHERE type = 'element_arena' AND metadata::jsonb ? 'number';

-- Step 2 (optional, for fresh installs): insert elements with the
-- corrected "atomic_number" key. These rows will be skipped by
-- the UPDATE above on existing databases because they already use
-- the new key, and on fresh databases they set up the correct schema.
-- Guarded with DO $$ to prevent errors on re-run.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM wordup_entities WHERE type = 'element_arena' LIMIT 1) THEN

        -- BATCH 1: BASE DATA
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Hydrogen',  '{"symbol":"H","atomic_number":1,"group":"Nonmetal"}',               1, ARRAY['nonmetal']),
        ('element_arena', 'Helium',    '{"symbol":"He","atomic_number":2,"group":"Noble Gas"}',             1, ARRAY['noble-gas']),
        ('element_arena', 'Carbon',    '{"symbol":"C","atomic_number":6,"group":"Nonmetal"}',               1, ARRAY['nonmetal']),
        ('element_arena', 'Oxygen',    '{"symbol":"O","atomic_number":8,"group":"Nonmetal"}',               1, ARRAY['nonmetal']),
        ('element_arena', 'Iron',      '{"symbol":"Fe","atomic_number":26,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Gold',      '{"symbol":"Au","atomic_number":79,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Silver',    '{"symbol":"Ag","atomic_number":47,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Sodium',    '{"symbol":"Na","atomic_number":11,"group":"Alkali Metal"}',         2, ARRAY['metal']),
        ('element_arena', 'Chlorine',  '{"symbol":"Cl","atomic_number":17,"group":"Halogen"}',              2, ARRAY['halogen']),
        ('element_arena', 'Nitrogen',  '{"symbol":"N","atomic_number":7,"group":"Nonmetal"}',               2, ARRAY['nonmetal']),
        ('element_arena', 'Uranium',   '{"symbol":"U","atomic_number":92,"group":"Actinide"}',              3, ARRAY['radioactive']),
        ('element_arena', 'Mercury',   '{"symbol":"Hg","atomic_number":80,"group":"Transition Metal"}',     3, ARRAY['metal','liquid']),
        ('element_arena', 'Copper',    '{"symbol":"Cu","atomic_number":29,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Aluminum',  '{"symbol":"Al","atomic_number":13,"group":"Post-Transition Metal"}', 2, ARRAY['metal']),
        ('element_arena', 'Calcium',   '{"symbol":"Ca","atomic_number":20,"group":"Alkaline Earth Metal"}', 2, ARRAY['metal']),
        ('element_arena', 'Lead',      '{"symbol":"Pb","atomic_number":82,"group":"Post-Transition Metal"}', 3, ARRAY['metal']),
        ('element_arena', 'Platinum',  '{"symbol":"Pt","atomic_number":78,"group":"Transition Metal"}',     3, ARRAY['metal','precious']),
        ('element_arena', 'Silicon',   '{"symbol":"Si","atomic_number":14,"group":"Metalloid"}',            2, ARRAY['metalloid']),
        ('element_arena', 'Xenon',     '{"symbol":"Xe","atomic_number":54,"group":"Noble Gas"}',            4, ARRAY['noble-gas']),
        ('element_arena', 'Tungsten',  '{"symbol":"W","atomic_number":74,"group":"Transition Metal"}',      4, ARRAY['metal']);

        -- BATCH 2: NOBLE GASES, HALOGENS & NONMETALS
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Neon',      '{"symbol":"Ne","atomic_number":10,"group":"Noble Gas"}',            1, ARRAY['noble-gas']),
        ('element_arena', 'Argon',     '{"symbol":"Ar","atomic_number":18,"group":"Noble Gas"}',            2, ARRAY['noble-gas']),
        ('element_arena', 'Krypton',   '{"symbol":"Kr","atomic_number":36,"group":"Noble Gas"}',            3, ARRAY['noble-gas']),
        ('element_arena', 'Radon',     '{"symbol":"Rn","atomic_number":86,"group":"Noble Gas"}',            4, ARRAY['noble-gas','radioactive']),
        ('element_arena', 'Fluorine',  '{"symbol":"F","atomic_number":9,"group":"Halogen"}',                2, ARRAY['halogen']),
        ('element_arena', 'Bromine',   '{"symbol":"Br","atomic_number":35,"group":"Halogen"}',              3, ARRAY['halogen','liquid']),
        ('element_arena', 'Iodine',    '{"symbol":"I","atomic_number":53,"group":"Halogen"}',               2, ARRAY['halogen']),
        ('element_arena', 'Astatine',  '{"symbol":"At","atomic_number":85,"group":"Halogen"}',              5, ARRAY['halogen','radioactive']),
        ('element_arena', 'Sulfur',    '{"symbol":"S","atomic_number":16,"group":"Nonmetal"}',              1, ARRAY['nonmetal']),
        ('element_arena', 'Phosphorus','{"symbol":"P","atomic_number":15,"group":"Nonmetal"}',              2, ARRAY['nonmetal']),
        ('element_arena', 'Selenium',  '{"symbol":"Se","atomic_number":34,"group":"Nonmetal"}',             3, ARRAY['nonmetal']);

        -- BATCH 3: ALKALI & ALKALINE EARTH METALS
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Lithium',   '{"symbol":"Li","atomic_number":3,"group":"Alkali Metal"}',          1, ARRAY['metal']),
        ('element_arena', 'Potassium', '{"symbol":"K","atomic_number":19,"group":"Alkali Metal"}',          2, ARRAY['metal']),
        ('element_arena', 'Rubidium',  '{"symbol":"Rb","atomic_number":37,"group":"Alkali Metal"}',         3, ARRAY['metal']),
        ('element_arena', 'Cesium',    '{"symbol":"Cs","atomic_number":55,"group":"Alkali Metal"}',         4, ARRAY['metal']),
        ('element_arena', 'Francium',  '{"symbol":"Fr","atomic_number":87,"group":"Alkali Metal"}',         5, ARRAY['metal','radioactive']),
        ('element_arena', 'Magnesium', '{"symbol":"Mg","atomic_number":12,"group":"Alkaline Earth Metal"}', 1, ARRAY['metal']),
        ('element_arena', 'Beryllium', '{"symbol":"Be","atomic_number":4,"group":"Alkaline Earth Metal"}',  3, ARRAY['metal']),
        ('element_arena', 'Strontium', '{"symbol":"Sr","atomic_number":38,"group":"Alkaline Earth Metal"}', 3, ARRAY['metal']),
        ('element_arena', 'Barium',    '{"symbol":"Ba","atomic_number":56,"group":"Alkaline Earth Metal"}', 3, ARRAY['metal']),
        ('element_arena', 'Radium',    '{"symbol":"Ra","atomic_number":88,"group":"Alkaline Earth Metal"}', 4, ARRAY['metal','radioactive']);

        -- BATCH 4: TRANSITION METALS
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Titanium',  '{"symbol":"Ti","atomic_number":22,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Chromium',  '{"symbol":"Cr","atomic_number":24,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Manganese', '{"symbol":"Mn","atomic_number":25,"group":"Transition Metal"}',     3, ARRAY['metal']),
        ('element_arena', 'Cobalt',    '{"symbol":"Co","atomic_number":27,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Nickel',    '{"symbol":"Ni","atomic_number":28,"group":"Transition Metal"}',     2, ARRAY['metal']),
        ('element_arena', 'Zinc',      '{"symbol":"Zn","atomic_number":30,"group":"Transition Metal"}',     1, ARRAY['metal']),
        ('element_arena', 'Zirconium', '{"symbol":"Zr","atomic_number":40,"group":"Transition Metal"}',     3, ARRAY['metal']),
        ('element_arena', 'Palladium', '{"symbol":"Pd","atomic_number":46,"group":"Transition Metal"}',     4, ARRAY['metal','precious']),
        ('element_arena', 'Cadmium',   '{"symbol":"Cd","atomic_number":48,"group":"Transition Metal"}',     3, ARRAY['metal']),
        ('element_arena', 'Osmium',    '{"symbol":"Os","atomic_number":76,"group":"Transition Metal"}',     4, ARRAY['metal']),
        ('element_arena', 'Iridium',   '{"symbol":"Ir","atomic_number":77,"group":"Transition Metal"}',     4, ARRAY['metal','precious']),
        ('element_arena', 'Vanadium',  '{"symbol":"V","atomic_number":23,"group":"Transition Metal"}',      3, ARRAY['metal']),
        ('element_arena', 'Molybdenum','{"symbol":"Mo","atomic_number":42,"group":"Transition Metal"}',     3, ARRAY['metal']),
        ('element_arena', 'Technetium','{"symbol":"Tc","atomic_number":43,"group":"Transition Metal"}',     5, ARRAY['metal','radioactive']),
        ('element_arena', 'Ruthenium', '{"symbol":"Ru","atomic_number":44,"group":"Transition Metal"}',     4, ARRAY['metal']),
        ('element_arena', 'Rhodium',   '{"symbol":"Rh","atomic_number":45,"group":"Transition Metal"}',     4, ARRAY['metal','precious']),
        ('element_arena', 'Tantalum',  '{"symbol":"Ta","atomic_number":73,"group":"Transition Metal"}',     4, ARRAY['metal']),
        ('element_arena', 'Rhenium',   '{"symbol":"Re","atomic_number":75,"group":"Transition Metal"}',     5, ARRAY['metal']),
        ('element_arena', 'Scandium',  '{"symbol":"Sc","atomic_number":21,"group":"Transition Metal"}',     4, ARRAY['metal']),
        ('element_arena', 'Yttrium',   '{"symbol":"Y","atomic_number":39,"group":"Transition Metal"}',      4, ARRAY['metal']),
        ('element_arena', 'Niobium',   '{"symbol":"Nb","atomic_number":41,"group":"Transition Metal"}',     4, ARRAY['metal']),
        ('element_arena', 'Hafnium',   '{"symbol":"Hf","atomic_number":72,"group":"Transition Metal"}',     4, ARRAY['metal']);

        -- BATCH 5: METALLOIDS & POST-TRANSITION METALS
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Boron',     '{"symbol":"B","atomic_number":5,"group":"Metalloid"}',              2, ARRAY['metalloid']),
        ('element_arena', 'Germanium', '{"symbol":"Ge","atomic_number":32,"group":"Metalloid"}',            3, ARRAY['metalloid']),
        ('element_arena', 'Arsenic',   '{"symbol":"As","atomic_number":33,"group":"Metalloid"}',            2, ARRAY['metalloid']),
        ('element_arena', 'Antimony',  '{"symbol":"Sb","atomic_number":51,"group":"Metalloid"}',            3, ARRAY['metalloid']),
        ('element_arena', 'Tellurium', '{"symbol":"Te","atomic_number":52,"group":"Metalloid"}',            4, ARRAY['metalloid']),
        ('element_arena', 'Polonium',  '{"symbol":"Po","atomic_number":84,"group":"Metalloid"}',            4, ARRAY['metalloid','radioactive']),
        ('element_arena', 'Tin',       '{"symbol":"Sn","atomic_number":50,"group":"Post-Transition Metal"}',2, ARRAY['metal']),
        ('element_arena', 'Bismuth',   '{"symbol":"Bi","atomic_number":83,"group":"Post-Transition Metal"}',3, ARRAY['metal']),
        ('element_arena', 'Gallium',   '{"symbol":"Ga","atomic_number":31,"group":"Post-Transition Metal"}',3, ARRAY['metal']),
        ('element_arena', 'Indium',    '{"symbol":"In","atomic_number":49,"group":"Post-Transition Metal"}',4, ARRAY['metal']),
        ('element_arena', 'Thallium',  '{"symbol":"Tl","atomic_number":81,"group":"Post-Transition Metal"}',4, ARRAY['metal']);

        -- BATCH 6: LANTHANIDES & ACTINIDES
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Lanthanum', '{"symbol":"La","atomic_number":57,"group":"Lanthanide"}',           3, ARRAY['metal']),
        ('element_arena', 'Cerium',    '{"symbol":"Ce","atomic_number":58,"group":"Lanthanide"}',           4, ARRAY['metal']),
        ('element_arena', 'Praseodymium','{"symbol":"Pr","atomic_number":59,"group":"Lanthanide"}',         5, ARRAY['metal']),
        ('element_arena', 'Neodymium', '{"symbol":"Nd","atomic_number":60,"group":"Lanthanide"}',           3, ARRAY['metal']),
        ('element_arena', 'Samarium',  '{"symbol":"Sm","atomic_number":62,"group":"Lanthanide"}',           4, ARRAY['metal']),
        ('element_arena', 'Europium',  '{"symbol":"Eu","atomic_number":63,"group":"Lanthanide"}',           4, ARRAY['metal']),
        ('element_arena', 'Gadolinium','{"symbol":"Gd","atomic_number":64,"group":"Lanthanide"}',           4, ARRAY['metal']),
        ('element_arena', 'Terbium',   '{"symbol":"Tb","atomic_number":65,"group":"Lanthanide"}',           5, ARRAY['metal']),
        ('element_arena', 'Dysprosium','{"symbol":"Dy","atomic_number":66,"group":"Lanthanide"}',           4, ARRAY['metal']),
        ('element_arena', 'Holmium',   '{"symbol":"Ho","atomic_number":67,"group":"Lanthanide"}',           5, ARRAY['metal']),
        ('element_arena', 'Erbium',    '{"symbol":"Er","atomic_number":68,"group":"Lanthanide"}',           5, ARRAY['metal']),
        ('element_arena', 'Thulium',   '{"symbol":"Tm","atomic_number":69,"group":"Lanthanide"}',           5, ARRAY['metal']),
        ('element_arena', 'Ytterbium', '{"symbol":"Yb","atomic_number":70,"group":"Lanthanide"}',           5, ARRAY['metal']),
        ('element_arena', 'Lutetium',  '{"symbol":"Lu","atomic_number":71,"group":"Lanthanide"}',           5, ARRAY['metal']),
        ('element_arena', 'Thorium',   '{"symbol":"Th","atomic_number":90,"group":"Actinide"}',             3, ARRAY['radioactive']),
        ('element_arena', 'Plutonium', '{"symbol":"Pu","atomic_number":94,"group":"Actinide"}',             4, ARRAY['radioactive']),
        ('element_arena', 'Americium', '{"symbol":"Am","atomic_number":95,"group":"Actinide"}',             4, ARRAY['radioactive']),
        ('element_arena', 'Curium',    '{"symbol":"Cm","atomic_number":96,"group":"Actinide"}',             5, ARRAY['radioactive']);

        -- BATCH 7: SUPERHEAVY SYNTHETIC ELEMENTS
        INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
        ('element_arena', 'Oganesson', '{"symbol":"Og","atomic_number":118,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Tennessine','{"symbol":"Ts","atomic_number":117,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Livermorium','{"symbol":"Lv","atomic_number":116,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Moscovium', '{"symbol":"Mc","atomic_number":115,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Flerovium', '{"symbol":"Fl","atomic_number":114,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Nihonium',  '{"symbol":"Nh","atomic_number":113,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Copernicium','{"symbol":"Cn","atomic_number":112,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Roentgenium','{"symbol":"Rg","atomic_number":111,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Darmstadtium','{"symbol":"Ds","atomic_number":110,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Meitnerium','{"symbol":"Mt","atomic_number":109,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Hassium',   '{"symbol":"Hs","atomic_number":108,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Bohrium',   '{"symbol":"Bh","atomic_number":107,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Seaborgium','{"symbol":"Sg","atomic_number":106,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Dubnium',   '{"symbol":"Db","atomic_number":105,"group":"Superheavy"}',          5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Rutherfordium','{"symbol":"Rf","atomic_number":104,"group":"Superheavy"}',       5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Lawrencium','{"symbol":"Lr","atomic_number":103,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Nobelium',  '{"symbol":"No","atomic_number":102,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Mendelevium','{"symbol":"Md","atomic_number":101,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']),
        ('element_arena', 'Fermium',   '{"symbol":"Fm","atomic_number":100,"group":"Actinide"}',            5, ARRAY['synthetic','radioactive']);

    END IF;
END $$;
