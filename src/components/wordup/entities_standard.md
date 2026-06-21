# WordUp Entity Structuring Standards

To maximize the quality, phrasing variety, and difficulty accuracy of the procedural question engine, follow these database contribution standards.

---

## 1. Schema Consistency

For the generator to find valid distractors, **at least 3 other entities in the same category must share the exact same metadata key**.
* **Rule**: Ensure that any new key you introduce (e.g. `atomic_mass`) is added to at least 4 entities in the category. Otherwise, it will never be selected for questions.

---

## 2. Smart Naming Conventions (For QuizUp Sentence Phrasing)

Our generator automatically scans key names to format human-like sentences. Always map your metadata keys to these suffixes:

| Key Suffix / Pattern | Suffix Type | Generated Question Phrasing Example |
|---|---|---|
| `author`, `director`, `founder`, `singer`, `artist`, `creator`, `written_by`, `developer`, `inventor` | **People / Nouns** | *"Who directed the movie [Movie]?"*, *"Who is the creative mind behind [Book]?"* |
| `date`, `year`, `released`, `founded`, `born`, `died` | **Temporal / Dates** | *"In what year was [Person] born?"*, *"When did [Concept] make its public debut?"* |
| `country`, `continent`, `location`, `city`, `state`, `capital` | **Geographical** | *"Where is [Location] situated?"*, *"What is the capital of [Location]?"* |
| `example` | **Conceptual** | *"Which of the following is an example of [Concept]?"* |
| `famous_for` | **Conceptual** | *"What is [Concept] famously celebrated for?"* |
| `contrast` | **Conceptual** | *"Which concept directly contrasts with [Concept]?"* |

---

## 3. Formatting Numeric Data

Never format numbers with text units inside the JSON string (e.g. `225M km` or `$1.5B`).
* **Incorrect**: `{"distance": "225M km", "revenue": "$1.5 Billion"}`
* **Correct**: `{"distance_million_km": 225, "revenue_usd_billion": 1.5}`
* **Why**: When values are clean numbers, the engine generates mathematically precise options (e.g. if the answer is 225, it computes distractors like 202, 247, 250). If the value is a string, it falls back to sampling other entities, producing less coherent choices.

---

## 4. Minimum Tags

Every entity should have at least **2 tags** in its `tags` array:
1. **Difficulty/Sub-classification Tag** (e.g., `easy`, `medium`, `hard`).
2. **Domain Group Tag** (e.g., `metalloid` for chemical elements, `europe` for capitals).
* **Why**: Tags are used to partition entities and ensure distractors belong to similar groups, making it harder for players to easily guess the correct answer by elimination.

---

## 5. Visual Clues (Images)

If you add an image clue to an entity:
1. Upload the image file (e.g. `.webp` or `.avif`) to the `wordup-questions` Supabase Storage bucket.
2. Add the filename to the entity metadata under the key `"image"`:
   `{"image": "paris_tower.webp"}`
3. The generator will automatically generate a public URL and serve the image preview to the frontend.
