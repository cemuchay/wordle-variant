# Question Configuration Customization Guide

All per-category tuning lives in a single file:

```
supabase/functions/generate-match-questions/questionConfig.ts
```

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

### 2. Variant Weights (`variantWeights`)

Controls how often each question variant appears. Array of 6 numbers (one per variant):

| Index | Variant | Description |
|-------|---------|-------------|
| `[0]` | Forward | "What is the capital of France?" |
| `[1]` | Reverse | "Which country has the capital Paris?" |
| `[2]` | Odd One Out | "Which doesn't share the same currency?" |
| `[3]` | True/False | "True or False: ..." |
| `[4]` | Multi-clue | "Identify from clues" |
| `[5]` | Correct the Error | "X is NOT Y. What is correct?" |

Higher weight = more likely to appear. The actual probability is `weight / sum(all weights)`.

```typescript
// Example: make Forward and True/False appear 3x more often than Odd One Out
flag_bearer: {
  variantWeights: [3, 2, 1, 2, 1, 1],
}
// Forward=30%, Reverse=20%, Odd=10%, T/F=20%, Clues=10%, Error=10%
```

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

## Quick Examples

```typescript
// More calculation, fewer entity facts for maths
maths: {
  proceduralWeight: 0.8,
  variantWeights: [3, 1, 1, 2, 1, 2],
}

// Only entity facts for capitals (no procedural)
capitals_clash: {
  variantWeights: [2, 2.5, 1, 1.5, 1.5, 0.5],  // Reverse even more common
}

// Heavy on True/False for flags
flag_bearer: {
  variantWeights: [2, 2, 1, 4, 1, 1],  // T/F has weight 4
}

// Add a new category override (copy this inside CATEGORY_QUESTION_CONFIG)
new_category_id: {
  proceduralWeight: 0.5,    // optional, defaults to 0.5
  variantWeights: [2, 2, 1, 1, 1, 1],  // optional, defaults to uniform
}
```

## Notes

- Weights are relative, not percentages. `[3, 1, 1, 1, 1, 1]` = Forward is 3/8 = 37.5%.
- If a variant can't be generated (not enough data), the system tries the next highest-weight variant before falling back to Forward.
- For `maths` and `english_language`, the `proceduralWeight` also applies to the "no entities" fallback in the standard category path.
