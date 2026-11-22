import { supabase } from "../../lib/supabaseClient";
import { safeLocalStorage } from "../../utils/storage";

export interface TopicResponseTelemetry {
   category: string;
   sampleCount: number;
   avgTime: number;
   p25Time: number;
   medianTime: number;
   p75Time: number;
   avgAccuracy: number;
   updatedAt: number;
}

const TELEMETRY_CACHE_KEY = "wordup_topic_telemetry_cache_v1";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Calibrated human response-time baselines (in seconds) per category.
 * p25Time = fast human recognition; medianTime = typical human response; p75Time = slower deliberation.
 */
export const TOPIC_HUMAN_BASELINES: Record<
   string,
   Omit<TopicResponseTelemetry, "category" | "updatedAt">
> = {
   flag_bearer:       { sampleCount: 25, avgTime: 1.85, p25Time: 1.15, medianTime: 1.70, p75Time: 2.45, avgAccuracy: 0.81 },
   mixed:             { sampleCount: 25, avgTime: 2.05, p25Time: 1.25, medianTime: 1.90, p75Time: 2.75, avgAccuracy: 0.78 },
   football:          { sampleCount: 25, avgTime: 2.10, p25Time: 1.30, medianTime: 1.95, p75Time: 2.80, avgAccuracy: 0.77 },
   sports:            { sampleCount: 25, avgTime: 2.10, p25Time: 1.30, medianTime: 1.95, p75Time: 2.80, avgAccuracy: 0.76 },
   television:        { sampleCount: 25, avgTime: 2.05, p25Time: 1.25, medianTime: 1.90, p75Time: 2.75, avgAccuracy: 0.78 },
   video_games:       { sampleCount: 25, avgTime: 2.05, p25Time: 1.25, medianTime: 1.90, p75Time: 2.75, avgAccuracy: 0.78 },
   general_knowledge: { sampleCount: 25, avgTime: 2.20, p25Time: 1.35, medianTime: 2.05, p75Time: 2.95, avgAccuracy: 0.76 },
   geography:         { sampleCount: 25, avgTime: 2.15, p25Time: 1.30, medianTime: 2.00, p75Time: 2.85, avgAccuracy: 0.77 },
   english_language:  { sampleCount: 25, avgTime: 2.25, p25Time: 1.40, medianTime: 2.10, p75Time: 3.00, avgAccuracy: 0.76 },
   bible:             { sampleCount: 25, avgTime: 2.30, p25Time: 1.45, medianTime: 2.15, p75Time: 3.10, avgAccuracy: 0.77 },
   history:           { sampleCount: 25, avgTime: 2.35, p25Time: 1.45, medianTime: 2.20, p75Time: 3.15, avgAccuracy: 0.75 },
   "global-politics": { sampleCount: 25, avgTime: 2.40, p25Time: 1.50, medianTime: 2.25, p75Time: 3.20, avgAccuracy: 0.74 },
   computers:         { sampleCount: 25, avgTime: 2.25, p25Time: 1.40, medianTime: 2.10, p75Time: 3.00, avgAccuracy: 0.76 },
   chemistry:         { sampleCount: 25, avgTime: 2.50, p25Time: 1.55, medianTime: 2.35, p75Time: 3.40, avgAccuracy: 0.73 },
   physics:           { sampleCount: 25, avgTime: 2.70, p25Time: 1.70, medianTime: 2.55, p75Time: 3.70, avgAccuracy: 0.72 },
   maths:             { sampleCount: 25, avgTime: 2.85, p25Time: 1.75, medianTime: 2.65, p75Time: 3.90, avgAccuracy: 0.74 },
   reverse_wordle:    { sampleCount: 25, avgTime: 3.10, p25Time: 1.95, medianTime: 2.90, p75Time: 4.20, avgAccuracy: 0.71 },
};

const memoryCache = new Map<string, TopicResponseTelemetry>();

function loadStorageCache(): Record<string, TopicResponseTelemetry> {
   try {
      const raw = safeLocalStorage.getItem(TELEMETRY_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
   } catch {
      return {};
   }
}

function saveStorageCache(entry: TopicResponseTelemetry) {
   try {
      memoryCache.set(entry.category, entry);
      const all = loadStorageCache();
      all[entry.category] = entry;
      safeLocalStorage.setItem(TELEMETRY_CACHE_KEY, JSON.stringify(all));
   } catch {
      // ignore storage errors
   }
}

/**
 * Synchronously returns the best available topic telemetry (from memory/localStorage or calibrated baseline).
 */
export function getCachedTopicTelemetry(category: string): TopicResponseTelemetry {
   const cat = category || "mixed";
   const mem = memoryCache.get(cat);
   if (mem) return mem;

   const stored = loadStorageCache()[cat];
   if (stored) {
      memoryCache.set(cat, stored);
      return stored;
   }

   const base = TOPIC_HUMAN_BASELINES[cat] || TOPIC_HUMAN_BASELINES.general_knowledge;
   return {
      category: cat,
      ...base,
      updatedAt: 0,
   };
}

/**
 * Fetches live human response-time telemetry for a category from Supabase,
 * blending with the topic baseline if sample count is low.
 */
export async function fetchTopicTelemetry(category: string): Promise<TopicResponseTelemetry> {
   const cat = category || "mixed";
   const cached = getCachedTopicTelemetry(cat);
   if (cached.updatedAt > 0 && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return cached;
   }

   const base = TOPIC_HUMAN_BASELINES[cat] || TOPIC_HUMAN_BASELINES.general_knowledge;

   try {
      const { data, error } = await supabase
         .from("wordup_topic_telemetry")
         .select("*")
         .eq("category", cat)
         .maybeSingle();

      if (!error && data) {
         const sampleCount = Number(data.sample_count) || base.sampleCount;
         // Confidence weight: 100% DB telemetry once sampleCount >= 30
         const w = Math.min(1, Math.max(0.25, sampleCount / 30));

         const blend = (dbVal: unknown, baseVal: number) => {
            const num = Number(dbVal);
            if (!Number.isFinite(num) || num <= 0) return baseVal;
            return parseFloat((num * w + baseVal * (1 - w)).toFixed(2));
         };

         const entry: TopicResponseTelemetry = {
            category: cat,
            sampleCount,
            avgTime: blend(data.avg_time_taken, base.avgTime),
            p25Time: blend(data.p25_time_taken, base.p25Time),
            medianTime: blend(data.median_time_taken, base.medianTime),
            p75Time: blend(data.p75_time_taken, base.p75Time),
            avgAccuracy: parseFloat(
               (
                  (Number(data.avg_accuracy) || base.avgAccuracy) * w +
                  base.avgAccuracy * (1 - w)
               ).toFixed(3),
            ),
            updatedAt: Date.now(),
         };
         saveStorageCache(entry);
         return entry;
      }
   } catch {
      // Fallback to cached or baseline
   }

   return cached;
}

/**
 * Records a human player's round response times and accuracy after a match finishes,
 * updating both the local telemetry cache immediately and the Supabase rolling telemetry table.
 */
export async function recordHumanTopicTelemetry(
   category: string,
   answers: Array<{ time_taken?: number; correct?: boolean }>,
): Promise<void> {
   const cat = category || "mixed";
   if (!Array.isArray(answers) || answers.length === 0) return;

   const valid = answers.filter(
      (a) => typeof a?.time_taken === "number" && a.time_taken >= 0.35 && a.time_taken <= 9.8,
   );
   if (valid.length === 0) return;

   const times = valid.map((a) => Number(a.time_taken!.toFixed(2)));
   const corrects = valid.map((a) => Boolean(a.correct));

   // 1. Update local cache immediately using exponential moving average
   const cur = getCachedTopicTelemetry(cat);
   const sorted = [...times].sort((a, b) => a - b);
   const batchAvg = sorted.reduce((s, x) => s + x, 0) / sorted.length;
   const batchP25 = sorted[Math.floor(sorted.length * 0.25)];
   const batchMed = sorted[Math.floor(sorted.length * 0.5)];
   const batchP75 = sorted[Math.floor(sorted.length * 0.75)];
   const batchAcc = corrects.filter(Boolean).length / corrects.length;

   const newCount = cur.sampleCount + valid.length;
   const alpha = Math.min(0.25, Math.max(0.06, valid.length / Math.max(20, newCount)));

   const updatedLocal: TopicResponseTelemetry = {
      category: cat,
      sampleCount: newCount,
      avgTime: parseFloat((cur.avgTime * (1 - alpha) + batchAvg * alpha).toFixed(2)),
      p25Time: parseFloat((cur.p25Time * (1 - alpha) + batchP25 * alpha).toFixed(2)),
      medianTime: parseFloat((cur.medianTime * (1 - alpha) + batchMed * alpha).toFixed(2)),
      p75Time: parseFloat((cur.p75Time * (1 - alpha) + batchP75 * alpha).toFixed(2)),
      avgAccuracy: parseFloat((cur.avgAccuracy * (1 - alpha) + batchAcc * alpha).toFixed(3)),
      updatedAt: Date.now(),
   };
   saveStorageCache(updatedLocal);

   // 2. Persist asynchronously to Supabase RPC
   try {
      await supabase.rpc("record_wordup_topic_telemetry", {
         p_category: cat,
         p_times_taken: times,
         p_corrects: corrects,
      });
   } catch {
      // Best-effort background telemetry sync
   }
}

