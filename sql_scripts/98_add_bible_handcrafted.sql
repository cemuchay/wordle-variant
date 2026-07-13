-- 98_add_bible_handcrafted.sql

-- Seeding handcrafted Bible questions with variations
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, variations) VALUES
-- 1. Next Book of the Bible
(
    'bible',
    'Which book of the Bible immediately follows ${book}?',
    ARRAY['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
    'Exodus',
    'Exodus immediately follows Genesis, describing the departure of the Israelites from Egypt.',
    '[
        {
            "params": {"book": "Genesis"},
            "answer": "Exodus",
            "choices": ["Exodus", "Leviticus", "Numbers", "Deuteronomy"],
            "explanation": "Exodus immediately follows Genesis, detailing the flight of Israel from Egypt."
        },
        {
            "params": {"book": "Matthew"},
            "answer": "Mark",
            "choices": ["Mark", "Luke", "John", "Acts"],
            "explanation": "Mark is the second Gospel, immediately following the Gospel of Matthew."
        },
        {
            "params": {"book": "Luke"},
            "answer": "John",
            "choices": ["John", "Acts", "Romans", "Mark"],
            "explanation": "John is the fourth Gospel, immediately following the Gospel of Luke."
        }
    ]'::jsonb
),

-- 2. King David relations
(
    'bible',
    'Who was the ${relation} of King David?',
    ARRAY['Jesse', 'Saul', 'Samuel', 'Solomon'],
    'Jesse',
    'Jesse was the father of David, a shepherd boy of Bethlehem who became the second king of Israel.',
    '[
        {
            "params": {"relation": "father"},
            "answer": "Jesse",
            "choices": ["Jesse", "Saul", "Samuel", "Solomon"],
            "explanation": "Jesse of Bethlehem was the father of King David."
        },
        {
            "params": {"relation": "son and successor"},
            "answer": "Solomon",
            "choices": ["Solomon", "Jonathan", "Absalom", "Nathan"],
            "explanation": "Solomon was the son of David and Bathsheba, succeeding David as king."
        }
    ]'::jsonb
),

-- 3. Prophets and places
(
    'bible',
    'Which prophet was thrown into ${place}?',
    ARRAY['Daniel', 'Elijah', 'Elisha', 'Jeremiah'],
    'Daniel',
    'Daniel was thrown into the den of lions for praying to God instead of the king.',
    '[
        {
            "params": {"place": "a den of lions"},
            "answer": "Daniel",
            "choices": ["Daniel", "Elijah", "Elisha", "Jeremiah"],
            "explanation": "Daniel survived being thrown into a den of lions due to his faithful devotion to God."
        },
        {
            "params": {"place": "the belly of a great fish"},
            "answer": "Jonah",
            "choices": ["Jonah", "Hosea", "Amos", "Obadiah"],
            "explanation": "Jonah spent three days and three nights in the belly of a great fish after fleeing God''s call."
        }
    ]'::jsonb
),

-- 4. Key numbers
(
    'bible',
    'How many ${item} were there?',
    ARRAY['6', '7', '10', '12'],
    '6',
    'God completed creation in 6 days and rested on the seventh.',
    '[
        {
            "params": {"item": "days of creation"},
            "answer": "6",
            "choices": ["6", "7", "5", "8"],
            "explanation": "Genesis states that God created the heavens and the earth in 6 days and rested on the 7th."
        },
        {
            "params": {"item": "original tribes of Israel"},
            "answer": "12",
            "choices": ["12", "10", "7", "14"],
            "explanation": "There were 12 tribes of Israel, named after the sons of Jacob."
        },
        {
            "params": {"item": "commandments given to Moses"},
            "answer": "10",
            "choices": ["10", "12", "7", "5"],
            "explanation": "God wrote the Ten Commandments on two tablets of stone on Mount Sinai."
        }
    ]'::jsonb
),

-- 5. Locations of events
(
    'bible',
    'Where did ${event} take place?',
    ARRAY['Cana', 'Nazareth', 'Jerusalem', 'Bethlehem'],
    'Cana',
    'Jesus performed His first miracle of turning water into wine at a wedding in Cana of Galilee.',
    '[
        {
            "params": {"event": "Jesus turn water into wine"},
            "answer": "Cana",
            "choices": ["Cana", "Nazareth", "Jerusalem", "Bethlehem"],
            "explanation": "Jesus performed His first public miracle at a wedding in Cana of Galilee."
        },
        {
            "params": {"event": "Moses receive the Ten Commandments"},
            "answer": "Mount Sinai",
            "choices": ["Mount Sinai", "Mount Ararat", "Mount Carmel", "Mount of Olives"],
            "explanation": "God gave the Ten Commandments to Moses on Mount Sinai."
        }
    ]'::jsonb
),

-- 6. Bible descriptions
(
    'bible',
    'Who was the ${description}?',
    ARRAY['Adam', 'Eve', 'Methuselah', 'Noah'],
    'Adam',
    'Adam was the first man created by God in the Garden of Eden.',
    '[
        {
            "params": {"description": "first man created by God"},
            "answer": "Adam",
            "choices": ["Adam", "Eve", "Cain", "Abel"],
            "explanation": "Adam was the first man formed from the dust of the ground."
        },
        {
            "params": {"description": "oldest man recorded in the Bible"},
            "answer": "Methuselah",
            "choices": ["Methuselah", "Noah", "Enoch", "Jared"],
            "explanation": "Methuselah is recorded to have lived for 969 years."
        }
    ]'::jsonb
),

-- 7. Apostles and actions
(
    'bible',
    'Which Apostle is known for ${action}?',
    ARRAY['Thomas', 'Peter', 'John', 'Judas'],
    'Thomas',
    'Thomas doubted the resurrection of Jesus until he saw the wounds himself.',
    '[
        {
            "params": {"action": "doubting the resurrection of Jesus"},
            "answer": "Thomas",
            "choices": ["Thomas", "Peter", "John", "Judas"],
            "explanation": "Thomas said he would not believe unless he saw the nail marks in Jesus'' hands."
        },
        {
            "params": {"action": "denying Jesus three times before the rooster crowed"},
            "answer": "Peter",
            "choices": ["Peter", "Andrew", "Thomas", "Philip"],
            "explanation": "Peter denied knowing Jesus three times out of fear during Jesus'' trial."
        }
    ]'::jsonb
),

-- 8. Bible Queens
(
    'bible',
    'Which queen ${deed}?',
    ARRAY['Queen of Sheba', 'Queen Esther', 'Queen Jezebel', 'Queen Vashti'],
    'Queen of Sheba',
    'The Queen of Sheba visited Jerusalem to test King Solomon with hard questions.',
    '[
        {
            "params": {"deed": "visited King Solomon to test his wisdom"},
            "answer": "Queen of Sheba",
            "choices": ["Queen of Sheba", "Queen Esther", "Queen Jezebel", "Queen Vashti"],
            "explanation": "The Queen of Sheba visited Solomon with a very great caravan and tested him with riddles."
        },
        {
            "params": {"deed": "saved the Jewish people from destruction in Persia"},
            "answer": "Queen Esther",
            "choices": ["Queen Esther", "Queen of Sheba", "Queen Jezebel", "Queen Vashti"],
            "explanation": "Queen Esther courageously petitioned King Ahasuerus to save her people from Haman''s plot."
        }
    ]'::jsonb
),

-- 9. Abraham relations
(
    'bible',
    'Who was the ${relation_type} of Abraham?',
    ARRAY['Sarah', 'Lot', 'Isaac', 'Ishmael'],
    'Sarah',
    'Sarah was the wife of Abraham and the mother of Isaac.',
    '[
        {
            "params": {"relation_type": "wife"},
            "answer": "Sarah",
            "choices": ["Sarah", "Rebekah", "Rachel", "Leah"],
            "explanation": "Sarah was Abraham''s wife and the mother of the promised child Isaac."
        },
        {
            "params": {"relation_type": "nephew who traveled with him"},
            "answer": "Lot",
            "choices": ["Lot", "Isaac", "Jacob", "Esau"],
            "explanation": "Lot was Abraham''s nephew who journeyed with him and later settled near Sodom."
        }
    ]'::jsonb
),

-- 10. Mountains
(
    'bible',
    'Which mountain did ${event_type}?',
    ARRAY['Mount Ararat', 'Mount Sinai', 'Mount Nebo', 'Mount Carmel'],
    'Mount Ararat',
    'Noah''s Ark came to rest on the mountains of Ararat as the floodwaters receded.',
    '[
        {
            "params": {"event_type": "Noah''s Ark rest upon after the flood"},
            "answer": "Mount Ararat",
            "choices": ["Mount Ararat", "Mount Sinai", "Mount Nebo", "Mount Carmel"],
            "explanation": "Genesis 8:4 states that the ark came to rest on the mountains of Ararat."
        },
        {
            "params": {"event_type": "Moses view the Promised Land from before dying"},
            "answer": "Mount Nebo",
            "choices": ["Mount Nebo", "Mount Sinai", "Mount Ararat", "Mount Carmel"],
            "explanation": "God led Moses to the peak of Mount Nebo to see the Promised Land before his death."
        }
    ]'::jsonb
);
