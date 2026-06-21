# WordUp Database Entities Quality & Depth Report

This report evaluates the depth, schema richness, and generation compatibility of the entities seeded in the `wordup_entities` table.

## Sample Entity Analysis (Random Sample of Categories)

| Category | Example Entity | Sample Metadata | Assessment |
|---|---|---|---|
| **capitals_clash** | `Paris` | `{"country":"France","continent":"Europe"}` | **High Quality**: Very clean. Standard fields ensure excellent distractor generation. |
| **currency_exchange** | `US Dollar` | `{"code":"USD","symbol":"$","country":"United States"}` | **High Quality**: Rich metadata allows symbols, codes, and countries to be queried. |
| **flag_bearer** | `Nigeria` | `{"colors":"Green, White, Green","stripes":3,"continent":"Africa"}` | **Medium Quality**: Color combinations are strings, which are hard to filter as distractors cleanly. |
| **element_arena** | `Hydrogen` | `{"symbol":"H","number":1,"group":"Nonmetal"}` | **High Quality**: The combination of string groups and numeric atomic numbers is excellent. |
| **animal_kingdom** | `Lion` | `{"class":"Mammal","habitat":"Savanna","diet":"Carnivore"}` | **High Quality**: Excellent tags and classification criteria. |
| **cosmic_frontier** | `Mars` | `{"type":"Planet","distance":"225M km","fact":"The Red Planet"}` | **Medium Quality**: Distances are text strings (e.g., "225M km") rather than numeric floats, preventing proper mathematical offsets. |
| **cinephile_trivia** | `The Godfather` | `{"year":1972,"director":"Francis Ford Coppola","genre":"Crime"}` | **High Quality**: Perfect integration with biography and time templates. |
| **history_milestones** | `World War II` | `{"year":1939,"endYear":1945,"era":"20th Century"}` | **High Quality**: Numeric years allow beautiful chronological logic and offsets. |
| **english_vocabulary** | `Benevolent` | `{"synonym": "kind", "antonym": "cruel", "definition": "well meaning and kindly"}` | **High Quality**: Enforces synonym/antonym structure, which matches grammar and verbal templates perfectly. |
| **math_fundamentals** | `Right Triangle` | `{"definition": "A triangle with one angle of exactly 90 degrees", "sum_of_angles": "180 degrees", "formula": "a^2 + b^2 = c^2"}` | **High Quality**: Great mix of geometric, formulaic, and definition keys. |

---

## Overall Assessment

### 1. Strengths
* **Dynamic Distractor Matching**: Over 80% of categories have high schema consistency (e.g. all capitals share `country` and `continent`), which guarantees that Deno can find at least 3 peers sharing the same keys.
* **Progressive Difficulty (1-5)**: Difficulty levels are mapped cleanly, matching the Easy/Medium/Hard progression loop.
* **NLP Friendly Key naming**: Naming keys like `director` or `year` maps perfectly to the smart phrasing engine.

### 2. Weaknesses / Limitations
* **Imprecise Numeric Types**: In categories like `cosmic_frontier`, numeric facts are represented as strings (e.g. `"225M km"`, `"384K km"`). This stops the engine from using `isNumeric` math offsets (+/- percentage bounds) and degrades Variant 3/5 quality.
* **Low Peer Density in Visual Clues**: Visual image keys exist for some custom entities, but if less than 3 other entities share that key structure, fallback logic might ignore it.
* **Vague Tags**: Tags are under-utilized. They should group entities by sub-domain (e.g. `organic`, `metalloid`, `solar-system`) so that distractors are highly related and realistic.

---

## Action Plan / Recommendations
1. **Normalize Numeric Strings**: Convert units like `"distance": "225M km"` to numeric values or separate them (`"distance_million_km": 225`).
2. **Standardize Naming Conventions**: Enforce the schemas defined in `entities_standard.md` to guarantee QuizUp-level prompts across all categories.
