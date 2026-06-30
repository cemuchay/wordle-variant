# Uploading Sentence Templates to Supabase

This document provides instructions on how to add and upload new sentence templates to the Wordle Variant database in Supabase.

## Table Schema: `curated_sentences`

The database table `public.curated_sentences` holds templates for generating coherent sentences. It has the following columns:

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key, auto-generated using `gen_random_uuid()` |
| `template` | `jsonb` | The structured template array representing static words and variable options |
| `word_count` | `int` | The number of words/slots in the template (between 3 and 10) |
| `created_at` | `timestamptz` | Date and time when the template was added |

---

## Sentence Template Syntax

Each template is stored as a JSON array (`jsonb`). Each element in the array represents one word slot in the sentence:

1. **Static Words (Strings)**: A simple string value. The word is used exactly as defined.
   * Example: `"THE"`
2. **Variable Choices (Arrays of Strings)**: An array containing multiple uppercase words. When a challenge is created, the system picks **one** of these options at random.
   * Example: `["CAT", "DOG", "FOX", "BEAR"]`

### Important Constraints
* **Word Length**: Every word (static or choice option) must be between **3 and 10 letters**.
* **Dictionary Validity**: Every word must exist in the Wordle dictionary (`valid` word list) for its respective length, otherwise players will not be able to guess it.
* **Casing**: All words must be in **UPPERCASE**.

### Example Template
A 3-word template:
```json
["THE", ["CAT", "DOG", "FOX"], ["SLEEPS", "RUNS", "JUMPS"]]
```
This template can randomly generate:
* `THE CAT SLEEPS`
* `THE DOG RUNS`
* `THE FOX JUMPS`
* ...and other combinations.

---

## How to Upload Templates

### Option 1: Via Supabase SQL Editor (Recommended)

1. Open your **Supabase Dashboard**.
2. Go to the **SQL Editor** tab from the left sidebar.
3. Click **New Query**.
4. Paste your insert statement and click **Run**.

#### Example SQL Insert:
```sql
insert into public.curated_sentences (template, word_count) values
  ('["THE", ["SUN", "MOON"], ["SHINES", "GLOWS"], "BRIGHT"]', 4),
  ('[["PEOPLE", "PLAYERS"], ["LOVE", "LIKE"], "THIS", "CLEVER", "GAME"]', 5);
```

### Option 2: Batch Uploading via Script

If you have a JSON file of templates, you can insert them using a Node.js script using the Supabase JavaScript Client:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_SERVICE_ROLE_KEY');

const newTemplates = [
  {
    template: ["YOU", ["CAN", "WILL"], "SOLVE", "THESE", ["WORDS", "PUZZLES"]],
    word_count: 5
  }
];

const { data, error } = await supabase
  .from('curated_sentences')
  .insert(newTemplates);

if (error) {
  console.error('Upload failed:', error);
} else {
  console.log('Upload successful:', data);
}
```
