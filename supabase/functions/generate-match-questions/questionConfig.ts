export const VARIANT_COUNT = 9;

export interface CategoryQuestionConfig {
   proceduralWeight: number;
   handcraftedWeaveProbability: number;
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
   config: {
      proceduralWeight?: number;
      handcraftedWeaveProbability?: number;
      weights: VariantWeights;
   },
): [string, Partial<CategoryQuestionConfig>] {
   return [
      id,
      {
         proceduralWeight: config.proceduralWeight,
         handcraftedWeaveProbability: config.handcraftedWeaveProbability,
         variantWeights: VARIANT_ORDER.map((k) => config.weights[k]),
      },
   ];
}

const DEFAULT_CONFIG: CategoryQuestionConfig = {
   proceduralWeight: 0.5,
   handcraftedWeaveProbability: 0.4,
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
      proceduralWeight: 1,
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
      proceduralWeight: 1,
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
      proceduralWeight: 0.6,
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
   define("football", {
      proceduralWeight: 0.0,
      handcraftedWeaveProbability: 1,
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
      handcraftedWeaveProbability: 0.15,
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
   define("bible", {
      proceduralWeight: 0.4,
      handcraftedWeaveProbability: 0.6,
      weights: {
         forward: 3,
         reverse: 2,
         oddOneOut: 1,
         trueFalse: 2.5,
         multiClue: 1.5,
         correctError: 1,
         tagMatch: 1,
         compare: 1,
         timeline: 1.5,
      },
   }),
]);

export async function fetchQuestionConfigFromDB(
   category: string,
   supabaseClient?: any,
): Promise<CategoryQuestionConfig> {
   const now = Date.now();

   // 1. Check in-memory TTL cache (5 min)
   const cached = topicCacheMap.get(category);
   if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
   }

   if (supabaseClient) {
      try {
         const { data, error } = await supabaseClient
            .from("topics")
            .select("slug, procedural_weight, handcrafted_weave_probability, variant_weights, is_default_fallback, is_suspended")
            .or(`slug.eq.${category},slug.eq.mixed,is_default_fallback.eq.true`)
            .eq("is_active", true);

         if (!error && data && data.length > 0) {
            // Find requested category row
            const targetRow = data.find((r: any) => r.slug === category);
            if (targetRow && targetRow.is_suspended) {
               throw new Error("CATEGORY_SUSPENDED: This topic is currently unavailable.");
            }

            // Find fallback row ('mixed' or is_default_fallback)
            const fallbackRow = data.find((r: any) => (r.slug === "mixed" || r.is_default_fallback) && !r.is_suspended);

            const chosenRow = targetRow || fallbackRow;



            if (chosenRow) {
               const parsedConfig: CategoryQuestionConfig = {
                  proceduralWeight: Number(chosenRow.procedural_weight ?? DEFAULT_CONFIG.proceduralWeight),
                  handcraftedWeaveProbability: Number(chosenRow.handcrafted_weave_probability ?? DEFAULT_CONFIG.handcraftedWeaveProbability),
                  variantWeights: padWeights(
                     DEFAULT_CONFIG.variantWeights,
                     (chosenRow.variant_weights || []).map((w: any) => Number(w)),
                  ),
               };

               validateConfig(category, parsedConfig);

               // Store in cache
               topicCacheMap.set(category, { config: parsedConfig, fetchedAt: now });
               return parsedConfig;
            }
         }
      } catch (err: any) {
         console.warn(`[questionConfig] Failed to fetch config from DB for "${category}":`, err.message);
      }
   }

   // 2. Synchronous fallback: inspect hardcoded table, then 'mixed', then DEFAULT_CONFIG
   const override = CATEGORY_QUESTION_CONFIG[category] || CATEGORY_QUESTION_CONFIG["mixed"] || {};
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
   topicCacheMap.set(category, { config: merged, fetchedAt: now });
   return merged;
}

export function getQuestionConfig(category: string): CategoryQuestionConfig {
   const cached = topicCacheMap.get(category);
   if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
   }

   const override = CATEGORY_QUESTION_CONFIG[category] || CATEGORY_QUESTION_CONFIG["mixed"] || {};
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

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const topicCacheMap = new Map<string, { config: CategoryQuestionConfig; fetchedAt: number }>();

function validateConfig(
   _category: string,
   config: CategoryQuestionConfig,
): void {

   const { proceduralWeight, handcraftedWeaveProbability, variantWeights } =
      config;

   if (proceduralWeight < 0 || proceduralWeight > 1) {
      config.proceduralWeight = Math.max(0, Math.min(1, proceduralWeight));
   }

   if (handcraftedWeaveProbability < 0 || handcraftedWeaveProbability > 1) {
      config.handcraftedWeaveProbability = Math.max(
         0,
         Math.min(1, handcraftedWeaveProbability),
      );
   }

   if (variantWeights.length !== VARIANT_COUNT) {
      config.variantWeights = padWeights(
         DEFAULT_CONFIG.variantWeights,
         variantWeights,
      );
   }

   for (let i = 0; i < variantWeights.length; i++) {
      if (variantWeights[i] < 0) {
         variantWeights[i] = 0;
      }
   }

   const sum = variantWeights.reduce((a, b) => a + b, 0);
   if (sum === 0) {
      config.variantWeights = [...DEFAULT_CONFIG.variantWeights];
   }
}

