export const VARIANT_COUNT = 9;

export interface CategoryQuestionConfig {
   proceduralWeight: number;
   variantWeights: number[];
}

interface VariantWeights {
   forward: number;
   reverse: number;
   oddOneOut: number;
   trueFalse: number;
   multiClue: number;
   correctError: number;
   tagMatch: number;
   compare: number;
   timeline: number;
}

const VARIANT_ORDER: (keyof VariantWeights)[] = [
   "forward",
   "reverse",
   "oddOneOut",
   "trueFalse",
   "multiClue",
   "correctError",
   "tagMatch",
   "compare",
   "timeline",
];

function define(
   id: string,
   config: { proceduralWeight?: number; weights: VariantWeights },
): [string, Partial<CategoryQuestionConfig>] {
   return [
      id,
      {
         proceduralWeight: config.proceduralWeight,
         variantWeights: VARIANT_ORDER.map((k) => config.weights[k]),
      },
   ];
}

const DEFAULT_CONFIG: CategoryQuestionConfig = {
   proceduralWeight: 0.5,
   variantWeights: [1, 1, 1, 1, 1, 1, 1, 1, 1],
};

function padWeights(base: number[], override: number[]): number[] {
   const result = [...override];
   while (result.length < base.length) {
      result.push(base[result.length]);
   }
   return result;
}

/**
 * Controls how often each question variant appears. Array of 9 numbers (one per variant):

| Index | Variant | Description | Condition |
|-------|---------|-------------|-----------|
| `[0]` | Forward | "What is the capital of France?" | Always available |
| `[1]` | Reverse | "Which country has the capital Paris?" | ≥3 peers with different values |
| `[2]` | Odd One Out | "Which doesn't share the same currency?" | ≥1 distractor + peers sharing another value |
| `[3]` | True/False | "True or False: The capital of France is London." | ≥1 distractor |
| `[4]` | Multi-clue | "Identify from clues" | ≥2 metadata keys + ≥3 different-value peers |
| `[5]` | Correct the Error | "X is NOT Y. What is correct?" | ≥1 distractor + ≥3 other distractors |
 | `[6]` | Tag Match | "Which category best fits France?" | Entity has tags + ≥3 other tags in pool |
| `[7]` | Compare (Numeric) | "Which has a higher atomic number: H or He?" | Numeric value + a peer with the same key |
| `[8]` | Timeline | "Which happened earliest?" | Year-like key + ≥4 entities with numeric values |

// Example: 9-element array
flag_bearer: {
  variantWeights: [3, 2, 1, 2, 1, 1, 1.5, 0, 0],
}
// Forward=30%, Reverse=20%, Odd=10%, T/F=20%, Clues=10%, Error=10%, Tag=15%, Compare=0%, Timeline=0%
 */

const CATEGORY_QUESTION_CONFIG = Object.fromEntries<
   Partial<CategoryQuestionConfig>
>([
   define("maths", {
      proceduralWeight: 0.8,
      weights: {
         forward: 3,
         reverse: 1,
         oddOneOut: 0,
         trueFalse: 2,
         multiClue: 0,
         correctError: 0,
         tagMatch: 0,
         compare: 1,
         timeline: 0,
      },
   }),
    define("english_language", {
       proceduralWeight: 0.6,
       weights: {
          forward: 2.5,
          reverse: 1,
          oddOneOut: 1,
          trueFalse: 2.5,
          multiClue: 0,
          correctError: 1,
          tagMatch: 0,
          compare: 1,
          timeline: 0,
       },
    }),
    define("english_fundamentals", {
       proceduralWeight: 0.5,
       weights: {
          forward: 2.5,
          reverse: 1.5,
          oddOneOut: 1,
          trueFalse: 2,
          multiClue: 1,
          correctError: 1,
          tagMatch: 1,
          compare: 1,
          timeline: 0,
       },
    }),
    define("physics", {
       proceduralWeight: 0.0,
       weights: {
          forward: 2.5,
          reverse: 1.5,
          oddOneOut: 1.5,
          trueFalse: 1.5,
          multiClue: 2,
          correctError: 1,
          tagMatch: 1.5,
          compare: 2.5,
          timeline: 0.5,
       },
    }),
    define("chemistry", {
       proceduralWeight: 0.0,
       weights: {
          forward: 2.5,
          reverse: 1.5,
          oddOneOut: 1.5,
          trueFalse: 1.5,
          multiClue: 2,
          correctError: 1,
          tagMatch: 1.5,
          compare: 2.5,
          timeline: 0.5,
       },
    }),
    define("biology", {
       proceduralWeight: 0.0,
       weights: {
          forward: 2.5,
          reverse: 1.5,
          oddOneOut: 1.5,
          trueFalse: 1.5,
          multiClue: 2,
          correctError: 1,
          tagMatch: 1.5,
          compare: 2,
          timeline: 0.5,
       },
    }),
    define("football", {
       proceduralWeight: 0.0,
       weights: {
          forward: 2.5,
          reverse: 1.5,
          oddOneOut: 1.5,
          trueFalse: 1.5,
          multiClue: 2,
          correctError: 1,
          tagMatch: 1.5,
          compare: 2.5,
          timeline: 1,
       },
    }),
    define("sports", {
       proceduralWeight: 0.0,
       weights: {
          forward: 2.5,
          reverse: 1.5,
          oddOneOut: 1.5,
          trueFalse: 1.5,
          multiClue: 2,
          correctError: 1,
          tagMatch: 1.5,
          compare: 2.5,
          timeline: 1,
       },
    }),
   define("flag_bearer", {
      weights: {
         forward: 3,
         reverse: 3,
         oddOneOut: 1,
         trueFalse: 3,
         multiClue: 0,
         correctError: 1,
         tagMatch: 1.5,
         compare: 0,
         timeline: 0,
      },
   }),
   define("capitals_clash", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1.5,
         trueFalse: 1.5,
         multiClue: 1,
         correctError: 1,
         tagMatch: 0,
         compare: 1,
         timeline: 0,
      },
   }),
   define("element_arena", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 3,
         timeline: 1,
      },
   }),
   define("animal_kingdom", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1.5,
         trueFalse: 1,
         multiClue: 1.5,
         correctError: 1,
         tagMatch: 2,
         compare: 1,
         timeline: 1,
      },
   }),
   define("cosmic_frontier", {
      weights: {
         forward: 2,
         reverse: 1.5,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 1,
         timeline: 1,
      },
   }),
   define("history_milestones", {
      weights: {
         forward: 1.5,
         reverse: 1.5,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2.5,
         correctError: 1,
         tagMatch: 1,
         compare: 1.5,
         timeline: 3,
      },
   }),
   define("cinephile_trivia", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 2,
         timeline: 2.5,
      },
   }),
   define("currency_exchange", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1.5,
         trueFalse: 1.5,
         multiClue: 1,
         correctError: 1,
         tagMatch: 1,
         compare: 0.5,
         timeline: 0,
      },
   }),
   define("naija_celebs", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 1.5,
         timeline: 1.5,
      },
   }),
   define("elon_musk", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 1.5,
         timeline: 1.5,
      },
   }),
   define("naija_music", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 1,
         timeline: 1.5,
      },
   }),
   define("unn_lions", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1.5,
         trueFalse: 1.5,
         multiClue: 1,
         correctError: 1,
         tagMatch: 1,
         compare: 1,
         timeline: 1,
      },
   }),
   define("nysc_trivia", {
      weights: {
         forward: 2,
         reverse: 2,
         oddOneOut: 1.5,
         trueFalse: 1.5,
         multiClue: 1,
         correctError: 1,
         tagMatch: 1,
         compare: 1,
         timeline: 1,
      },
   }),
   define("us_tech_trivia", {
      weights: {
         forward: 2,
         reverse: 1.5,
         oddOneOut: 1,
         trueFalse: 1.5,
         multiClue: 2,
         correctError: 1,
         tagMatch: 1,
         compare: 1.5,
         timeline: 2,
      },
   }),
]);

export function getQuestionConfig(category: string): CategoryQuestionConfig {
   const override = CATEGORY_QUESTION_CONFIG[category] || {};
   const merged: CategoryQuestionConfig = {
      ...DEFAULT_CONFIG,
      ...override,
   };
   if (override.variantWeights) {
      merged.variantWeights = padWeights(
         DEFAULT_CONFIG.variantWeights,
         override.variantWeights,
      );
   }
   validateConfig(category, merged);
   return merged;
}

function validateConfig(
   category: string,
   config: CategoryQuestionConfig,
): void {
   const { proceduralWeight, variantWeights } = config;

   if (proceduralWeight < 0 || proceduralWeight > 1) {
      console.warn(
         `[questionConfig] "${category}": proceduralWeight ${proceduralWeight} is out of range [0,1]. Clamping.`,
      );
      config.proceduralWeight = Math.max(0, Math.min(1, proceduralWeight));
   }

   if (variantWeights.length !== VARIANT_COUNT) {
      console.warn(
         `[questionConfig] "${category}": variantWeights has ${variantWeights.length} elements, expected ${VARIANT_COUNT}. Padding.`,
      );
      config.variantWeights = padWeights(
         DEFAULT_CONFIG.variantWeights,
         variantWeights,
      );
   }

   for (let i = 0; i < variantWeights.length; i++) {
      if (variantWeights[i] < 0) {
         console.warn(
            `[questionConfig] "${category}": variantWeights[${i}] is ${variantWeights[i]}, must be >= 0. Setting to 0.`,
         );
         variantWeights[i] = 0;
      }
      if (variantWeights[i] > 20) {
         console.warn(
            `[questionConfig] "${category}": variantWeights[${i}] is ${variantWeights[i]} (very high). Weights are relative — this means ~${Math.round((variantWeights[i] / variantWeights.reduce((a, b) => a + b, 0)) * 100)}% chance for this variant.`,
         );
      }
   }

   const sum = variantWeights.reduce((a, b) => a + b, 0);
   if (sum === 0) {
      console.warn(
         `[questionConfig] "${category}": all variant weights are 0. Reverting to defaults.`,
      );
      config.variantWeights = [...DEFAULT_CONFIG.variantWeights];
   }
}
