# Adding a New Procedural Category

No edge function changes. No client generator changes. Two steps only.

---

## Step 1: Insert entities into `wordup_entities`

Each entity row represents a fact the generic question engine can ask about.

```sql
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('my_category',  'Entity Label',  '{"key": "value"}',  1,  ARRAY['tag1']);
```

### Field guide

| Field | Description | Example |
|---|---|---|
| `type` | Category ID (must match the UI `id` in step 2) | `'capitals_clash'` |
| `label` | The entity name — used as the answer or question subject | `'Paris'` |
| `metadata` | Arbitrary key-value pairs the generic generator reads dynamically | `'{"country":"France","continent":"Europe"}'` |
| `difficulty` | 1 (easy) to 5 (hard) — controls progressive round mapping | `2` |
| `tags` | Filterable labels for future use | `ARRAY['europe']` |

### Rules for metadata keys (To optimize NLP Sentence Phrasing)

To make sentence construction look professional and human (rather than "cringe AI"), the engine automatically infers dates, people, and locations using specific keyword suffixes. Follow these naming conventions in your JSON metadata keys:

- **People / Creator Keys**: Use keys containing `author`, `director`, `founder`, `singer`, `artist`, `creator`, `written_by`, or `developer`.
  - *Resulting Prompts*: *"Who wrote [label]?"*, *"Who directed [label]?"*.
- **Temporal / Date Keys**: Use keys containing `date`, `year`, `released`, `founded`, `born`, `died`.
  - *Resulting Prompts*: *"When was [label] born?"*, *"In what year was [label] released?"*.
- **Location Keys**: Use keys like `country`, `continent`, `city`, `state`, `capital`.
  - *Resulting Prompts*: *"Where is [label] located?"*, *"What is the capital of [label]?"*.

### Distractors and Constraints

- For any key to be queried, at least **3 other entities** in the database pool must share that key (to generate valid distractors).
- If the value is a **numeric or year value**, the engine automatically generates **mathematically sensible distractors** (+/- offsets, magnitude adjustments) and true/false values.
- **Visual Clues (Images)**: You can bind an image to an entity by adding an `"image"` key to its metadata. The value should be the filename (e.g. `"paris.webp"` or `"logo.avif"`) of the image uploaded to the `wordup-questions` Supabase Storage bucket.

### Scaling & Category Specifics

- **Entity Saturation (100 selection limit)**: The generator pools up to **100 entities** per category, seed-shuffles them, and divides them into difficulty tiers.
- **English Language Category (`english_vocabulary`)**:
  - Store vocabulary words here with the metadata structure:
    `{"synonym": "kind", "antonym": "cruel", "definition": "well meaning and kindly"}`.
  - The engine will dynamically formulate questions around these keys (synonyms, antonyms, definitions) using the procedural engine.

### Example SQL Inserts

```sql
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('my_category', 'Alpha',  '{"color": "Red",   "shape": "Circle"}',  1, ARRAY['easy']),
('my_category', 'Beta',   '{"color": "Blue",  "shape": "Square"}',  3, ARRAY['medium']),
('my_category', 'Gamma',  '{"color": "Green", "shape": "Triangle", "image": "gamma_triangle.webp"}', 5, ARRAY['hard']);
```

---

## Step 2: Add a UI entry in `constants.ts`

File: `src/components/wordup/WordUpView/constants.ts`

```typescript
{ id: "my_category", name: "My Category", desc: "What it's about", type: "procedural" },
```

The `type: "procedural"` signals:
- The **CategorySelectModal** renders it under the "Knowledge Categories" section (cyan styling)
- The **questionService.ts** routes it to the edge function.

---

## How the generic engine works (so you know what to expect)

When a match starts with `my_category`:

1. Edge function fetches all entities with `type = 'my_category'` (up to 100).
2. It partitions the entities into difficulty pools:
   - **Easy**: `difficulty <= 2`
   - **Medium**: `difficulty = 3`
   - **Hard**: `difficulty >= 4`
3. Generates a progressive 7-round game sequence: **2 Easy** questions, **3 Medium** questions, and **2 Hard** questions (falling back to other pools if specific tiers are underpopulated).
4. Generates a randomized question variant (Forward, Reverse, Odd One Out, True/False, Multi-clue, Correct the Error), automatically filtering the choices list so that **no options are duplicated** and all choice sets are **strictly 4 or less**.
