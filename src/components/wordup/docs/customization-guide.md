# Question Configuration Customization Guide

## File Locations

| File | Purpose |
|------|---------|
| `supabase/functions/generate-match-questions/questionConfig.ts` | Per-category weights for variants and procedural ratio |
| `supabase/functions/generate-match-questions/index.ts` | Main generator — variant logic in `_generateQuestion()` (variants 0-8) |
| `supabase/functions/generate-match-questions/promptFormatter.ts` | Prompt templates for variants 0,1,3,5 (others are inline) |

---

## What You Can Tweak

### 1. Procedural vs Entity Ratio (`proceduralWeight`)

Controls how often procedural questions (maths calc, English grammar) are generated vs using database entity facts.

```typescript
maths: {
  proceduralWeight: 0.7,   // 70% procedural calculation, 30% entity facts
}
```

| Value | Meaning |
|-------|---------|
| `0` | Always use DB entity facts |
| `0.5` | 50/50 split (default) |
| `1` | Always use procedural generation |

Only affects `maths` and `english_language`. Other categories always use entity facts.

### 2. Variant Weights (`weights`)

Controls how often each question variant appears. Uses a named object so you can see at a glance which weight belongs to which variant:

```typescript
define("flag_bearer", {
  weights: {
    forward: 3,       // "What is the capital of France?"
    reverse: 3,       // "Which country has the capital Paris?"
    oddOneOut: 1,     // "Which doesn't share the same currency?"
    trueFalse: 3,     // "True or False: ..."
    multiClue: 0.5,   // "Identify from clues"
    correctError: 1,  // "X is NOT Y. What is correct?"
    tagMatch: 1.5,    // "Which tag best describes France?"
    compare: 0,       // "Which has a higher atomic number: H or He?"
    timeline: 0,      // "Which happened earliest?"
  },
})
// Forward=24%, Reverse=24%, Odd=8%, T/F=24%, Clues=4%, Error=8%, Tag=12%, Compare=0%, Timeline=0%
```

Higher weight = more likely to appear. The actual probability is `weight / sum(all weights)`. Setting a weight to `0` disables that variant entirely.

**Conditions matter**: If a variant's condition fails (e.g. Compare picked but no numeric peer exists), the system tries the next highest-weight variant before falling back to Forward.

| Variant | Condition |
|---------|-----------|
| `forward` | Always available |
| `reverse` | ≥3 peers with different values |
| `oddOneOut` | ≥1 distractor + peers sharing another value |
| `trueFalse` | ≥1 distractor |
| `multiClue` | ≥2 metadata keys + ≥3 different-value peers |
| `correctError` | ≥1 distractor + ≥3 other distractors |
| `tagMatch` | Entity has tags + ≥3 other tags in pool |
| `compare` | Numeric value + a peer with the same key |
| `timeline` | Year-like key + ≥4 entities with numeric values |

---

## Category ID Reference

Config keys match the category IDs exactly:

```
capitals_clash       currency_exchange    flag_bearer
element_arena        animal_kingdom       cosmic_frontier
history_milestones   cinephile_trivia     naija_celebs
elon_musk            naija_music          unn_lions
nysc_trivia          us_tech_trivia       maths
english_language
```

---

## Which Variants Work Per Category

Compare and Timeline require numeric data. Not all categories have it:

| Category | Tag Match (V6) | Compare (V7) | Timeline (V8) |
|----------|---------------|--------------|---------------|
| capitals_clash | ✅ | ❌ (text only) | ❌ (no years) |
| currency_exchange | ✅ | ❌ (text) | ❌ |
| flag_bearer | ✅ | ❌ (text) | ❌ |
| element_arena | ✅ | ✅ atomic number | ❌ |
| animal_kingdom | ✅ | ❌ (text) | ❌ |
| cosmic_frontier | ✅ | ❌ (distances are strings) | ❌ |
| history_milestones | ✅ | ✅ year, endYear | ✅ year |
| cinephile_trivia | ✅ | ✅ year | ✅ year |
| naija_celebs | ✅ | ✅ birth_year | ✅ birth_year |
| elon_musk | ✅ | ✅ birth_year | ✅ birth_year |
| naija_music | ✅ | ✅ year | ✅ year |
| maths | ✅ | ✅ (procedural only) | ❌ |
| english_language | ✅ | ❌ (text) | ❌ |

Set a variant's weight to `0` for categories where it never applies (e.g. `timelineWeight: 0` for `flag_bearer`).

---

## Quick Examples

```typescript
define("maths", {
  proceduralWeight: 0.8,
  weights: {
    forward: 3, reverse: 1, oddOneOut: 1, trueFalse: 2,
    multiClue: 1, correctError: 2, tagMatch: 1, compare: 1, timeline: 0,
  },
})

// Heavy on True/False for flags, disable compare+timeline
define("flag_bearer", {
  weights: {
    forward: 2, reverse: 2, oddOneOut: 1, trueFalse: 4,
    multiClue: 1, correctError: 1, tagMatch: 1.5, compare: 0, timeline: 0,
  },
})

// Boost timeline for history
define("history_milestones", {
  weights: {
    forward: 1.5, reverse: 1.5, oddOneOut: 1, trueFalse: 1.5,
    multiClue: 2.5, correctError: 1, tagMatch: 1, compare: 1.5, timeline: 3,
  },
})

// Boost compare for elements
define("element_arena", {
  weights: {
    forward: 2, reverse: 2, oddOneOut: 1, trueFalse: 1.5,
    multiClue: 2, correctError: 1, tagMatch: 1, compare: 3, timeline: 1,
  },
})

// Add a new category override
define("new_category_id", {
  proceduralWeight: 0.5,
  weights: {
    forward: 2, reverse: 2, oddOneOut: 1, trueFalse: 1,
    multiClue: 1, correctError: 1, tagMatch: 1, compare: 1, timeline: 1,
  },
})
```

---

## Notes

- Weights are relative, not percentages. `{ forward: 3, reverse: 1, ... }` = Forward is `3 / sum(all weights)`.
- If a variant can't be generated (not enough data), the system tries the next highest-weight variant before falling back to Forward.
- Setting a weight to `0` disables that variant entirely.
- Arrays shorter than 9 elements are automatically padded with default values (no breakage when upgrading old configs).
- The `padWeights` function in `questionConfig.ts` handles this merging automatically.

### Validation Rules (`validateConfig` in `questionConfig.ts`)

When the config loads, these checks run and log warnings:

| Rule | What happens |
|------|-------------|
| `proceduralWeight` must be 0–1 | Clamped to valid range |
| Array must have exactly 9 elements | Padded with defaults if too short |
| All weights must be ≥ 0 | Negative values reset to 0 |
| Weight > 20 | Warning logged (probably a mistake) |
| Sum of all weights is 0 | Reverts to default uniform weights |

Examples of bad configs that get caught:

```typescript
// Weight > 20 — warning logged
weights: { forward: 99, reverse: 1, oddOneOut: 1, trueFalse: 1, multiClue: 1,
           correctError: 1, tagMatch: 1, compare: 1, timeline: 1 }
// ~92% chance for Forward, likely a mistake

// Negative weight — reset to 0
weights: { forward: -1, reverse: 2, oddOneOut: 1, trueFalse: 1, multiClue: 1,
           correctError: 1, tagMatch: 1, compare: 1, timeline: 1 }

// All zero — reverts to defaults
weights: { forward: 0, reverse: 0, oddOneOut: 0, trueFalse: 0, multiClue: 0,
           correctError: 0, tagMatch: 0, compare: 0, timeline: 0 }
```
