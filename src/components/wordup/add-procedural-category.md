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

- All entities in a category should share the **same metadata keys** so distractors work correctly
- Prefer keys where **most entities have unique values** — the generator automatically picks the most distinctive key (highest unique-value ratio)
- Common/shared keys (like `continent` where many entities share `"Europe"`) work but produce harder reverse questions — the generator validates that distractor options don't also match the queried value

### Example: 3 entities for `my_category`

```sql
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
('my_category', 'Alpha',  '{"color": "Red",   "shape": "Circle"}',  1, ARRAY['easy']),
('my_category', 'Beta',   '{"color": "Blue",  "shape": "Square"}',  2, ARRAY['medium']),
('my_category', 'Gamma',  '{"color": "Green", "shape": "Triangle"}', 3, ARRAY['hard']);
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
3. `scoreKeys()` scans all entities' metadata — finds `color` and `shape` keys, counts unique values
4. `pickBestKey()` picks the most distinctive key (e.g. `color` if all 3 values differ)
5. `generateQuestion()` creates the question:
   - Low difficulty (1-2): *"What is the color of Alpha?"* → `"Red"`
   - High difficulty (4-5): *`"Red"` is the color of which option?* → `"Alpha"`
   - Distractors are sampled from other entities' same metadata key, validated to not match the correct answer

---

## Summary

| What | Where | How |
|---|---|---|
| Add facts | `INSERT INTO wordup_entities` | SQL migration file |
| Add UI entry | `constants.ts` | One line with `type: "procedural"` |
| Edge function | — | No changes |
| Client generators | — | No changes |
