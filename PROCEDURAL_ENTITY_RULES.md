# WordUp: Procedural Entity Standards & Rules

To ensure that the procedural question generation engine works flawlessly and scales to any conceivable topic (languages, math, chemistry, physics, etc.), all entries in the `wordup_entities` table must conform to these strict rules.

---

## 1. Baseline Schema (Mandatory for All Entities)

Every entity added to the database **must** contain at least the following keys in its JSONB `metadata` column:

```json
{
  "description": "Short, clear description or definition of the entity.",
  "category": "Taxonomy or group name",
  "difficulty": 1,
  "popularity": 90,
  "images": [
    "relative_supabase_storage_key.png",
    "https://external-domain.com/image.jpg"
  ]
}
```

* **`description`**: Used for identity/definition questions.
* **`category`**: Used for category match and odd-one-out variants.
* **`difficulty`**: Integer between `1` and `5` (1 = Beginner, 5 = Impossible/Expert).
* **`popularity`**: Integer between `0` and `100` (used for priority selection and matchmaking).
* **`images`**: An array of strings containing image references. Relative paths are pre-pended with the Supabase storage URL. External HTTPS URLs are resolved as-is.

### Tags Constraint
Every entity must have **exactly 2 tags** in the `tags` array column:
1. Tag 1: The super category (e.g., `person`, `concept`, `calculation`).
2. Tag 2: The sub-category (e.g., `physics`, `chemistry`, `music`).

*Example:* `ARRAY['person', 'physics']` or `ARRAY['concept', 'geography']`.

---

## 2. Universal Schema Standards

Each entity should align with one of the three core classes below, enriching its JSONB metadata with topic-specific keys.

### Class A: Biographies (Persons)
Used for historical figures, scientists, writers, actors, and other key figures.

* **Mandatory Keys**:
  * `birth_year` (integer): Year of birth (negative for BCE).
  * `nationality` (string): Country of origin.
  * `achievement` (string): Primary contribution, discovery, or creation.
* **Tags**: `['person', '{field}']`

*Example:*
```json
{
  "description": "German-born theoretical physicist who developed the theory of relativity.",
  "category": "Physicist",
  "difficulty": 2,
  "popularity": 100,
  "birth_year": 1879,
  "death_year": 1955,
  "nationality": "German",
  "achievement": "Theory of relativity",
  "images": ["albert_einstein.jpg"]
}
```

### Class B: Facts / Concepts / Objects
Used for chemical elements, animal species, space objects, countries, capitals, etc.

* **Mandatory Keys**:
  * `group` (string): Scientific/geographical group (e.g. "Noble Gas", "Mammal", "Planet").
  * `primary_val` (string): The core identifier property (e.g. Chemical symbol, currency code).
  * `secondary_val` (string/number): A secondary property (e.g. atomic number, capital city).
  * `association` (string, optional): Associated entity (e.g. habitat for animals, country for capitals).
* **Tags**: `['concept', '{sub_category}']`

*Example:*
```json
{
  "description": "A light, highly reactive alkali metal.",
  "category": "Alkali Metal",
  "difficulty": 2,
  "popularity": 85,
  "group": "Alkali Metal",
  "primary_val": "Li",
  "secondary_val": 3,
  "association": "Lithium batteries",
  "images": ["lithium_metal.jpg"]
}
```

### Class C: Calculations / Formulas / Systems
Used for math/physics equations, grammatical structures, tenses, and chemical reactions.

* **Mandatory Keys**:
  * `formula` (string): Mathematical equation or pattern formatted with formula notation (see rules below).
  * `definition` (string): Simple narrative explanation of the formula/rule.
  * `example_template` (string): Sentence or equation demonstrating the rule.
* **Tags**: `['calculation', '{subject}']`

*Example:*
```json
{
  "description": "Relates the length of the sides of a right triangle.",
  "category": "Geometry",
  "difficulty": 1,
  "popularity": 98,
  "formula": "$a^2 + b^2 = c^2$",
  "definition": "The square of the hypotenuse is equal to the sum of the squares of the other two sides.",
  "example_template": "In a right triangle with sides $a = 3$ and $b = 4$, the hypotenuse is $c = 5$."
}
```

---

## 3. Mathematical Formula Notation Rules

Formulas must be wrapped in mathematical delimiters so they are parsed and rendered correctly in the UI:

1. **Inline Formulas**: Wrap in single dollar signs, e.g. `$E = mc^2$`.
2. **Block Formulas**: Wrap in double dollar signs for standalone centered blocks, e.g. `$$a^2 + b^2 = c^2$$`.
3. **Exponents**: Format using `^`, e.g. `x^2`, `10^{-5}` (braces for multiple characters).
4. **Subscripts**: Format using `_`, e.g. `H_2O`, `x_{ij}` (braces for multiple characters).
5. **Multiplication**: Use `*` instead of x, e.g. `$F = m * a$`.
