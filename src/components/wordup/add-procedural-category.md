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
| `difficulty` | 1 (easy) to 5 (hard) — controls forward vs reverse questioning | `2` |
| `tags` | Filterable labels for future use | `ARRAY['europe']` |

### Rules for metadata keys

- Entities in the same category can have **different/non-uniform metadata keys** (varying schemas). The engine dynamically infers the appropriate key per target entity at runtime.
- For any key to be queried, at least **3 other entities** in the retrieved pool must share that key (to generate valid distractors from the peer pool).
- If the correct answer of a selected metadata key is a **numeric or year value** (e.g., key contains "year", "date", "pop" or value is numeric), the engine automatically generates **mathematically sensible distractors** (+/- 1, 2, 5, 10, or relative percentage bounds) and true/false values, ensuring challenging game choices.
- **Visual Clues (Images)**: You can bind an image to an entity by adding an `"image"` key to its metadata. The value should be the filename (e.g. `"paris.webp"` or `"logo.avif"`) of the image uploaded to the `wordup-questions` Supabase Storage bucket. The engine will automatically generate the public URL and render the image clue in the client.

### Example: 3 entities for `my_category`

```sql
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('my_category', 'Alpha',  '{"color": "Red",   "shape": "Circle"}',  1, ARRAY['easy']),
('my_category', 'Beta',   '{"color": "Blue",  "shape": "Square"}',  2, ARRAY['medium']),
('my_category', 'Gamma',  '{"color": "Green", "shape": "Triangle", "image": "gamma_triangle.webp"}', 3, ARRAY['hard']);
```

With 3+ entities the generator produces 7 rounds cycling through them (7 unique questions if you have at least 7 entities; fewer entities means repeats with different question variants).

### Two algorithmic exceptions

`mental_math_blitz` and `sequence_solver` generate questions without any entities — they're purely mathematical. No `wordup_entities` rows needed.

---

## Step 2: Add a UI entry in `constants.ts`

File: `src/components/wordup/WordUpView/constants.ts`

```typescript
{ id: "my_category", name: "My Category", desc: "What it's about", type: "procedural" },
```

The `type: "procedural"` signals:
- The **CategorySelectModal** renders it under the "Knowledge Categories" section (cyan styling)
- The **questionService.ts** routes it to the edge function (`isProceduralCategory` returns `true` because it's not in the hardcoded legacy set)
- The edge function handles generation generically — no code changes needed

---

## How the generic engine works (so you know what to expect)

When a match starts with `my_category`:

1. Edge function fetches all entities with `type = 'my_category'` (up to 14)
2. For each of 7 rounds, picks `entity[i % entityList.length]`
3. The engine extracts the metadata keys available for the target entity, shuffles them, and searches for a key shared by at least 3 peers.
4. If a shared key is found, that key is selected for the round. Otherwise, it falls back to the first available key.
5. If the correct answer is numeric or a year, the engine generates mathematically sensible distractors. Otherwise, it samples distractors from other peer entities sharing that key.
6. Generates a randomized question variant (Forward, Reverse, Odd One Out, True/False, Multi-clue, Correct the Error).
   - True/False (Variant 3) and Correct the Error (Variant 5) use the generated distractors (e.g., mathematically sensible false values for numeric/year keys).

---

## Summary

| What | Where | How |
|---|---|---|
| Add facts | `INSERT INTO wordup_entities` | SQL migration file |
| Add UI entry | `constants.ts` | One line with `type: "procedural"` |
| Edge function | — | No changes |
| Client generators | — | No changes |
