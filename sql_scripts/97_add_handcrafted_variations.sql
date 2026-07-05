-- 97_add_handcrafted_variations.sql

-- 1. Add the variations column to wordup_handcrafted_questions
ALTER TABLE public.wordup_handcrafted_questions ADD COLUMN IF NOT EXISTS variations JSONB DEFAULT NULL;

-- 2. Seed some premium variation-based handcrafted questions
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, variations) VALUES
-- FOOTBALL
(
    'football', 
    'Which country won the FIFA World Cup in ${year}?', 
    ARRAY['Argentina', 'France', 'Germany', 'Spain', 'Italy', 'Brazil', 'Croatia', 'Netherlands', 'Belgium', 'England'], 
    'Argentina', -- fallback base answer
    'Argentina won the FIFA World Cup in 2022 after defeating France in a penalty shootout.', -- fallback base explanation
    '[
        {
            "params": {"year": "2022"},
            "answer": "Argentina",
            "choices": ["Argentina", "France", "Croatia", "Morocco", "Brazil", "England", "Netherlands", "Portugal"],
            "explanation": "Argentina won the 2022 World Cup in Qatar, defeating France on penalties after a historic 3-3 draw."
        },
        {
            "params": {"year": "2018"},
            "answer": "France",
            "choices": ["France", "Croatia", "Belgium", "England", "Brazil", "Uruguay", "Sweden", "Russia"],
            "explanation": "France won the 2018 World Cup in Russia, defeating Croatia 4-2 in the final."
        },
        {
            "params": {"year": "2014"},
            "answer": "Germany",
            "choices": ["Germany", "Argentina", "Netherlands", "Brazil", "Colombia", "Belgium", "France", "Costa Rica"],
            "explanation": "Germany won the 2014 World Cup in Brazil, defeating Argentina 1-0 in extra time."
        },
        {
            "params": {"year": "2010"},
            "answer": "Spain",
            "choices": ["Spain", "Netherlands", "Germany", "Uruguay", "Argentina", "Brazil", "Ghana", "Paraguay"],
            "explanation": "Spain won the 2010 World Cup in South Africa, defeating the Netherlands 1-0 in extra time."
        }
    ]'::jsonb
),

-- CHEMISTRY
(
    'chemistry', 
    'Which element has the chemical symbol "${symbol}"?', 
    ARRAY['Gold', 'Silver', 'Copper', 'Iron', 'Oxygen', 'Hydrogen', 'Carbon', 'Nitrogen', 'Helium', 'Sodium'], 
    'Gold',
    'Au is the symbol of Gold (from the Latin word "Aurum").',
    '[
        {
            "params": {"symbol": "Au"},
            "answer": "Gold",
            "choices": ["Gold", "Silver", "Copper", "Platinum", "Mercury", "Lead", "Tin"],
            "explanation": "Au is the chemical symbol for Gold, derived from the Latin word \"Aurum\"."
        },
        {
            "params": {"symbol": "Ag"},
            "answer": "Silver",
            "choices": ["Silver", "Gold", "Platinum", "Mercury", "Copper", "Zinc", "Nickel"],
            "explanation": "Ag is the chemical symbol for Silver, derived from the Latin word \"Argentum\"."
        },
        {
            "params": {"symbol": "Fe"},
            "answer": "Iron",
            "choices": ["Iron", "Copper", "Nickel", "Cobalt", "Manganese", "Chromium", "Zinc"],
            "explanation": "Fe is the chemical symbol for Iron, derived from the Latin word \"Ferrum\"."
        },
        {
            "params": {"symbol": "Na"},
            "answer": "Sodium",
            "choices": ["Sodium", "Potassium", "Lithium", "Calcium", "Magnesium", "Barium"],
            "explanation": "Na is the chemical symbol for Sodium, derived from the Latin word \"Natrium\"."
        }
    ]'::jsonb
);
