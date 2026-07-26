export const VARIANT_COUNT = 9;

export interface CategoryQuestionConfig {
   proceduralWeight: number;
   handcraftedWeaveProbability: number;
   variantWeights: number[];
}

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
         if (err.message?.includes("CATEGORY_SUSPENDED")) {
            throw err;
         }
         console.warn(`[questionConfig] Failed to fetch config from DB for "${category}":`, err.message);
      }
   }

   // 2. Fallback to DEFAULT_CONFIG
   const merged: CategoryQuestionConfig = { ...DEFAULT_CONFIG };
   validateConfig(category, merged);
   topicCacheMap.set(category, { config: merged, fetchedAt: now });
   return merged;
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

export function getQuestionConfig(category: string): CategoryQuestionConfig {
   const cached = topicCacheMap.get(category);
   if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
   }

   const merged: CategoryQuestionConfig = { ...DEFAULT_CONFIG };
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

