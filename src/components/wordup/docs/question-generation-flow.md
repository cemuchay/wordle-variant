# WordUp Question Generation Flow

## Architecture Overview

```
User selects category → Match created (wordup_matches)
  → questionService.generateMatchQuestions()
    → LEGACY? → wordupQuestionGenerator.ts (client-side, 22 word types)
    → PROCEDURAL? → generate-match-questions Edge Function (server-side)
      → Client decrypts → postProcessQuestions (flag_bearer only) → Battle
```

---

## Routing — `src/services/wordup/generatorRegistry.ts`

Legacy (word-based) categories — **generated client-side**:
```
mixed, 3_letters, 4_letters, 5_letters, 6_letters, 7_plus,
vowel_drop, anagram_scrambled, reverse_wordle, missing_letter,
word_ladder, rhyme_match, letter_count
```

**Everything else** is procedural (knowledge-based) — generated via Supabase Edge Function.

---

## Path 1: Legacy Word Engine — Client Side

**File**: `src/utils/wordupQuestionGenerator.ts` (~2266 lines)

### 22 Question Types

| # | Type | Description |
|---|------|-------------|
| 1 | `real_fake` | Is this a real word? |
| 2 | `length` | How many letters? |
| 3 | `definition` | What does this word mean? |
| 4 | `anagram` | Rearrange to form a word |
| 5 | `anagram_scrambled` | Which is the correct anagram? |
| 6 | `missing_letter` | What letter is missing? |
| 7 | `pattern` | Which fits the pattern? |
| 8 | `math` | Simple math with words |
| 9 | `odd_one_out` | Which word doesn't belong? |
| 10 | `synonym_match` | Find the synonym |
| 11 | `word_chain` | Chain following letter rules |
| 12 | `letter_shift` | Caesar cipher style |
| 13 | `compound_break` | Split compound words |
| 14 | `cryptogram` | Letter substitution |
| 15 | `category_sort` | Group by category |
| 16 | `letter_add_remove` | Add/remove a letter |
| 17 | `reverse_wordle` | Guess the Wordle from results |
| 18 | `word_within` | Find a word inside a word |
| 19 | `fill_blank` | Complete the phrase |
| 20 | `unscramble` | Unscramble letters |
| 21 | `scrambled_words` | Multiple scrambled words |
| 22 | `vowel_count` | Count the vowels |

### Randomizer

- **`getTypeByWeight()`**: Weighted random selection (weights 0.6–1.0 per type). If user picks a specific type as their category, returns that directly.
- **`pickWeightedLength()`**: Lengths 3, 8, 9, 10 get weight 3.5; others get 0.8.
- **7 rounds**: Each round calls `getTypeByWeight()` + `pickWeightedLength()`, generates the question, shuffles choices via `Math.random() - 0.5`.
- **Encryption**: XOR-based secret key (`generateSecretKey()` + `encryptQuestions()`).

---

## Path 2: Procedural Categories — Edge Function

**File**: `supabase/functions/generate-match-questions/index.ts` (546 lines)

### 1. Entity Fetching

```typescript
supabaseClient.rpc("get_wordup_entities_v2", {
  p_category: category,
  p_user_ids: playerIds,      // excludes previously seen entities
  p_limit_per_type: 40
})
```

Returns randomized entities from `wordup_entities` table, filtered by user history (seeded from SQL `65_wordup_seed_facts.sql`).

### 2. Super Categories — `types.ts`

| Super Category | Categories |
|----------------|------------|
| `science_facts` | capitals_clash, currency_exchange, flag_bearer, element_arena, animal_kingdom, cosmic_frontier, history_milestones, unn_lions, nysc_trivia, us_tech_trivia |
| `biography` | naija_celebs, elon_musk |
| `creative_work` | cinephile_trivia, naija_music |
| `calculations` | maths |
| `language_arts` | english_language |

### 3. Algorithmic Categories — `ALGORITHMIC_CATEGORIES`

- **`maths`** → 50% procedural calculation, 50% DB entity fact
- **`english_language`** → 50% procedural grammar, 50% DB entity fact

These have dedicated generators (`maths.ts`, `english.ts`) that produce fully procedural questions (no DB entities).

### 4. Variant Randomizer — `index.ts:360-364`

6 variants (0–5), 7 rounds:

```typescript
const baseVariants = [0, 1, 2, 3, 4, 5];
const shuffledVariants = seededShuffle(baseVariants, matchRng);
const extraVariant = Math.floor(matchRng() * 6);
const variantSequence = [...shuffledVariants, extraVariant];
```

**Guarantees**: All 6 variants appear at least once across 7 rounds. The 7th is a random repeat.

| Variant | Type | Description | Example Prompt |
|---------|------|-------------|----------------|
| **0: Forward** | `definition` | "What is the {key} of {label}?" | "What is the currency of France?" |
| **1: Reverse** | `definition` | "Which has {key} '{value}'?" | "Which country has the currency 'Euro'?" |
| **2: Odd One Out** | `definition` | "Which doesn't share the same {key}?" | "Which does not share the same currency as the others?" |
| **3: True/False** | `definition` | True/False affirmation | "True or False: The capital of France is London." |
| **4: Multi-clue** | `definition` | "Identify from clues" | Bulleted clues from 2-3 metadata keys |
| **5: Correct the Error** | `definition` | "NOT {wrong}. What is correct?" | "The capital of France is NOT London. What is the correct capital?" |

### 5. Difficulty Progression — `index.ts:367-370`

- `easy` (difficulty ≤ 2) → rounds 0-1
- `medium` (difficulty == 3) → rounds 2-4
- `hard` (difficulty ≥ 4) → rounds 5-6

Falls back through pools when one is exhausted.

### 6. Seeded Randomness — `utils.ts` / `seededRandom.ts`

All randomness is **deterministic** (same inputs = same questions):

```typescript
// LCG pseudo-random generator
let s = seed;
return () => {
  s = (s * 1664525 + 1013904223) & 0xffffffff;
  return (s >>> 0) / 4294967296;
};
```

- Master seed: `{matchId}-{category}`
- Round seed: `{master}-{i}`
- Fisher-Yates seeded shuffle

### 7. Key Selection Logic — `_generateQuestion:67-99`

1. Filter metadata keys (skip: `_distractors`, `_symbolDistractors`, `_directorDistractors`, `id`, `image`)
2. Find a key shared by **≥3 peer entities** (ensures good distractor pool)
3. Fallback: use first available key, all peers as distractors
4. Detect numeric vs text values → pick distractor strategy

### 8. Distractor Generation — `utils.ts`

**Numeric values** (`getNumericDistractors`):
- Year-aware offsets (±1–25 for years 1000–2100)
- Magnitude-aware offsets (percentage-based for large numbers: 0.5×, 0.2×, 0.1× magnitude)
- Preserves formatting (`$`, `%` suffixes/prefixes)

**Text values**:
- Peer entity values from same metadata key
- Padded with `"Alternative {label} Metric"` if insufficient

**Distractor pool**: 5 generated, 4 selected per question (shuffled with correct answer).

### 9. Prompt Formatting — `promptFormatter.ts`

Super-category-aware contextual prompts:

| Super Category | Forward Example | Reverse Example | True/False Example |
|----------------|-----------------|-----------------|-------------------|
| `biography` | "When was {label} born?" | "Which person was born in {value}?" | "{label} is associated with {value}" |
| `creative_work` | "Who directed {label}?" | "Which film was directed by {value}?" | "{label} was released in {value}" |
| `science_facts` | "What is the {key} of {label}?" | "Which has the {key} '{value}'?" | "The {key} of {label} is {value}" |
| `language_arts` | "Which is a synonym of '{label}'?" | "Which word is a synonym of '{value}'?" | "A synonym of {label} is {value}" |
| `calculations` | *Falls through to generic* | | |

Handles special metaphor detection for: `synonym`, `antonym`, `definition`, `example`, `famous_for`, `contrast`, location keys (`country`, `continent`, `capital`, etc.), time keys (`year`, `date`, `founded`, `released`, etc.).

---

## Maths Procedural Generation — `maths.ts`

50% chance of pure procedural (when `useDB = entity && rng() > 0.5`, or entity is null).

4 sub-types (random `Math.floor(rng() * 4)`):

| Sub-type | Pattern | Example |
|----------|---------|---------|
| **Arithmetic** | `+`, `-`, `×`, `/` (10-99 range) | "Calculate: 45 × 12 = ?" |
| **Sequences** | 6 patterns (add 2, multiply 2, add 3, squares, subtract 5, triangular) | "Find the next: 2, 4, 6, 8, ?" |
| **Algebra** | Linear `ax + b = c` or simultaneous `x+y / x-y` | "Solve for x: 3x + 5 = 20" |
| **Geometry** | Triangle area, rectangle perimeter, supplementary angles | "Find the area of a triangle with base 8 and height 5" |

### Distractors for Maths

Uses `smartFakeAnswers()`: correct ± 1, 2, 5, 10, 10%, then shuffles and picks 3.

---

## English Language Procedural Generation — `english.ts`

50% chance of pure procedural (`useDB = entity && rng() > 0.5`).

4 sub-types (random `Math.floor(rng() * 4)`):

| Sub-type | Example |
|----------|---------|
| **Subject-Verb Agreement** | "Every morning, my father ___ the newspaper." → reads/read/reading/readed |
| **Plurals** | "What is the correct plural of 'cactus'?" → cacti/cactuses/cactus/cactii |
| **Spelling** | "Identify the correct spelling:" → definitely/definately/definitly/definatley |
| **Tenses** | "They had already ___ when I arrived." → eaten/ate/eat/eating |

Hardcoded sentence/word banks; no dynamic generation.

---

## Post-Processing — `wordupQuestionPostProcessor.ts`

Only activates for `flag_bearer` category. Transforms text-based flag questions into visual formats.

### Transformation Logic

1. **Choices are flag codes** (Variant 0/5 with `flag_code` key):
   - Prompt → `"Identify the flag of {country}:"`
   - Sets `imageUrls` array from flag codes

2. **True/False with flag names** (Variant 3):
   - Prompt → `"True or False: This is the flag of {country}."`
   - Sets `imageUrl` with flag code

3. **Answer is a flag code** (Variant 1):
   - Prompt → `"Which country does this flag belong to?"`
   - Sets `imageUrl` with answer flag code

4. **Fallback**: Scans prompt for country names → attaches flag image

### Image Preloading
- `preloadMatchImages()` — preloads all images before battle
- Dual CDN fallback: `flagcdn.com` → `github.com/lipis/flag-icons` (raw)
- Retry logic: 3 attempts with 500ms delay per CDN

### Usage Chain
1. `questionService.ts` → gets encrypted questions
2. Client decrypts (AES-GCM preferred, XOR fallback)
3. `useWordUpStore.setQuestions()` → calls `postProcessQuestions(questions, category)`
4. Battle hooks → call `preloadMatchImages(questions)` for flag_bearer
5. `BattleView` / `GameOverView` → render via `getCachedFlagUrl()`

---

## Encryption

### Edge Function (Procedural)
- AES-GCM 256-bit key (`crypto.subtle.generateKey`)
- 12-byte random IV, combined with ciphertext, base64-encoded
- Stored in `wordup_matches.questions` + `wordup_matches.encryption_key`
- Fallback: `wordup_match_payloads` table if direct update fails

### Legacy (Client-side)
- XOR-based secret key
- Less secure, simpler, no server dependency

---

## Entity History Tracking

- After successful generation, calls `record_user_entities_seen` RPC with `p_user_ids` + `p_entity_ids`
- Prevents repeating entities in future matches for both players

---

## Client-Side Fallback Generators

If the Edge Function is unavailable, the client has local fallback generators:

| Generator | Source Type | Entities |
|-----------|-------------|----------|
| `capitalsClash.ts` | Hardcoded EntitySeed[] | 20 capital cities |
| `currencyExchange.ts` | Hardcoded EntitySeed[] | 20 currencies |
| `flagBearer.ts` | Hardcoded EntitySeed[] | 20 countries |
| `elementArena.ts` | Hardcoded EntitySeed[] | 20 chemical elements |
| `animalKingdom.ts` | Hardcoded EntitySeed[] | 20 animals |
| `cosmicFrontier.ts` | Hardcoded EntitySeed[] | 20 space entities |
| `historyMilestones.ts` | Hardcoded EntitySeed[] | 20 historical events |
| `cinephileTrivia.ts` | Hardcoded EntitySeed[] | 20 movies |
| `mentalMathBlitz.ts` | **Procedural** (no entities) | Generates arithmetic questions |
| `sequenceSolver.ts` | **Procedural** (no entities) | Generates number sequences |

Registered in `GeneratorRegistry` at `src/services/wordup/generatorRegistry.ts`.

---

## Initiation Points (Match Flow)

| Context | Source File | How |
|---------|------------|-----|
| Live match | `useWordUpLiveGame.ts` | Calls `generateMatchQuestions()` after match creation |
| Bot match | `useWordUpBotGame.ts` | Calls `generateMatchQuestions()` for bot rematch |
| Async match | `useWordUpAsyncGame.ts` | Calls `generateMatchQuestions()` when loading |
| Invites | `App.tsx:482-533` | Listens for `wordup_invite` broadcasts, creates match, calls generator |
| Matchmaking | `useMatchmaking.ts` | Creates match on queue success, calls generator |
| Direct play | `LobbyView.tsx` | Legacy path to `generateMatchQuestions()` |

---

## Key Files Reference

| File | Role |
|------|------|
| `src/services/wordup/questionService.ts` | Routing: procedural → edge function, legacy → local |
| `src/services/wordup/generatorRegistry.ts` | Category classification + fallback generators |
| `src/services/wordup/legacyWordEngine.ts` | Wraps legacy generator to uniform interface |
| `src/utils/wordupQuestionGenerator.ts` | Client-side legacy word engine (22 types) |
| `supabase/functions/generate-match-questions/index.ts` | Main edge function for procedural questions |
| `supabase/functions/generate-match-questions/maths.ts` | Procedural maths generator |
| `supabase/functions/generate-match-questions/english.ts` | Procedural English generator |
| `supabase/functions/generate-match-questions/types.ts` | Category→super map + entity types |
| `supabase/functions/generate-match-questions/utils.ts` | Seeded RNG, shuffle, distractor helpers |
| `supabase/functions/generate-match-questions/promptFormatter.ts` | Human-readable prompt templates |
| `src/utils/wordupQuestionPostProcessor.ts` | Flag→Visual post-processing |
| `src/constants/wordup.ts` | Game constants (rounds=7, durations, ratings) |
| `src/types/generators.ts` | BaseQuestion, QuizGenerator, EntitySeed interfaces |
| `src/services/wordup/seededRandom.ts` | Client-side deterministic RNG |
| `sql_scripts/65_wordup_seed_facts.sql` | Entity seed data (capitals, currencies, etc.) |
| `sql_scripts/64_wordup_entities.sql` | wordup_entities table DDL |
