# Adding a New Topic & Facts (WordUp Knowledge Engine Flow)

Under the relational Knowledge Engine architecture, new categories are added dynamically through structured databases rows without modifying server-side code or client-side generators.

Follow this guide to define a new topic, create entity types, declare predicates, insert entities with their facts, associate media assets, and author custom question templates.

---

## Step 1: Define the Topic
Topics represent playable categories. Insert the topic slug and name:

```sql
INSERT INTO public.topics (id, slug, name)
VALUES ('a2ce8a30-01d7-46c5-8422-79fc74d47190', 'astronomy', 'Astronomy');
```

---

## Step 2: Define Entity Types
Entity types define the classifications of entities belonging to this topic (e.g. Planets, Stars, Galaxies):

```sql
INSERT INTO public.entity_types (id, topic_id, name)
VALUES ('b2ce8a30-02d7-46c5-8422-79fc74d47290', 'a2ce8a30-01d7-46c5-8422-79fc74d47190', 'Planet');
```

---

## Step 3: Define Predicates
Predicates represent properties or attributes of the entities and define the expected data type:

```sql
INSERT INTO public.predicates (id, topic_id, name, value_type)
VALUES 
('d2ce8a30-03d7-46c5-8422-79fc74d47391', 'a2ce8a30-01d7-46c5-8422-79fc74d47190', 'distance_from_sun', 'text'),
('d2ce8a30-03d7-46c5-8422-79fc74d47392', 'a2ce8a30-01d7-46c5-8422-79fc74d47190', 'moons_count', 'integer');
```

### Supported Predicate Value Types
* `entity`: References another entity's name (e.g. stadium, country).
* `year`: Represents a temporal calendar year (e.g. 1955, 2026).
* `integer`: Whole numbers (e.g. 17, 79).
* `decimal`: Precision decimal numbers (e.g. 0.107, 3.14).
* `enum`: Specific string categories (e.g. Gas, Solid, Liquid).
* `text`: General textual properties.

---

## Step 4: Insert Entities
Entities represent the actual subjects/objects that can be queried:

```sql
INSERT INTO public.entities (id, topic_id, type_id, label, difficulty, tags)
VALUES ('e2ce8a30-04d7-46c5-8422-79fc74d47490', 'a2ce8a30-01d7-46c5-8422-79fc74d47190', 'b2ce8a30-02d7-46c5-8422-79fc74d47290', 'Mars', 1, ARRAY['planet', 'rocky']);
```

* **Difficulty**: Ranges from `1` (easy) to `5` (hard) and controls round progression.
* **Tags**: Metadata labels for filtering or custom groupings.

---

## Step 5: Insert Facts
Facts connect entities to their predicate values:

```sql
INSERT INTO public.facts (subject_id, predicate_id, value)
VALUES 
('e2ce8a30-04d7-46c5-8422-79fc74d47490', 'd2ce8a30-03d7-46c5-8422-79fc74d47391', '227.9 million km'),
('e2ce8a30-04d7-46c5-8422-79fc74d47490', 'd2ce8a30-03d7-46c5-8422-79fc74d47392', '2');
```

---

## Step 6: Define Media Assets
Associate visual or structural media assets with the entity. Upload files to the `wordup-questions` Supabase storage bucket, then catalog them:

```sql
INSERT INTO public.assets (entity_id, asset_type, file)
VALUES ('e2ce8a30-04d7-46c5-8422-79fc74d47490', 'image', 'mars_surface.webp');
```

---

## Step 7: Create Question Templates
Create reusable question templates for the topic. These are processed dynamically:

```sql
INSERT INTO public.question_templates (topic_id, answer_key, required_keys, prompts, explanations)
VALUES (
  'a2ce8a30-01d7-46c5-8422-79fc74d47190',
  'distance_from_sun',
  ARRAY['distance_from_sun'],
  ARRAY['What is the distance of {planet} from the Sun?'],
  ARRAY['{label} is located {distance_from_sun} away from the Sun.']
);
```

### Template Layout Settings
* **`answer_key`**: (Optional) Specifies which predicate value represents the correct answer.
  - If specified (e.g., `'symbol'` or `'distance_from_sun'`), the question asks for that property. The correct choice is the fact value, and distractors are other entities' fact values for that predicate (e.g. "What is the symbol of Gold?" -> Choices: `Au`, `H` -> Answer: `Au`).
  - If set to `NULL` (or omitted), the correct answer is the entity's `label` itself, and distractors are other entities' labels (e.g. "Which element has atomic number 79?" -> Choices: `Gold`, `Hydrogen` -> Answer: `Gold`).
* **`required_keys`**: List of predicates that must be populated on the entity for this template to match.
* **`prompts`**: Array of prompt strings. Supports placeholders.
* **`explanations`**: Array of explanation strings. Supports placeholders.

### Prompt Placeholder Rules
* `{label}` is replaced with the entity's label (e.g. `Mars`).
* `{entity_type}` placeholders matching the entity type name (e.g. `{planet}`, `{club}`, `{player}`) are replaced with the entity's label.
* `{predicate_name}` placeholders matching any item in `required_keys` are replaced with the respective fact's value (e.g. `{distance_from_sun}` is replaced with `227.9 million km`).

---

## Step 8: Add Category Select UI Entry
To make the new topic selectable in-game, add it to:
`src/wordup/shared/constants.ts`

```typescript
{
   id: "astronomy", // Must match topic.slug
   name: "Astronomy",
   desc: "Planets, stars, galaxies, and cosmic phenomenon",
   featured: true
}
```
If the category slug matches the topic's slug, `get_wordup_entities_v2` dynamically aggregates the relational schema into standard metadata and feeds it directly to the match questions Edge Function.
