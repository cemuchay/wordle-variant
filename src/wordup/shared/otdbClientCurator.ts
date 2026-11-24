import { supabase } from "../../lib/supabaseClient";
import { safeLocalStorage } from "../../utils/storage";
import {
   OTDB_CATEGORIES,
   buildOtdbUrl,
   normalizeOtdbResult,
   otdbCategoryForTopic,
   type CuratedQuestion,
   type OtdbRawResult,
} from "./otdbCore";

export const CLIENT_CURATION_KEY = "wordup_otdb_client_curated_at";
export const CLIENT_CURATION_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const CURATION_TTL_DAYS = 30;
const AMOUNT = 15;

let inFlight = false;

export function isClientCurationDue(now = Date.now()): boolean {
   const last = Number(safeLocalStorage.getItem(CLIENT_CURATION_KEY) || 0);
   return !last || now - last >= CLIENT_CURATION_COOLDOWN_MS;
}

/**
 * Fire-and-forget client-side trivia curation while the user is in /wordup.
 * Throttled per browser (6h) and per category server-side (6h); never throws.
 */
export async function maybeCurateWordUpTrivia(preferredTopic?: string | null): Promise<number> {
   try {
      if (inFlight) return 0;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
      if (!isClientCurationDue()) return 0;

      inFlight = true;
      // Stamp up-front so failures / rate limits also respect the cooldown
      safeLocalStorage.setItem(CLIENT_CURATION_KEY, String(Date.now()));

      const cat =
         (preferredTopic && otdbCategoryForTopic(preferredTopic)) ||
         OTDB_CATEGORIES[Math.floor(Math.random() * OTDB_CATEGORIES.length)];

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let results: OtdbRawResult[] = [];
      try {
         const res = await fetch(buildOtdbUrl(cat.id, AMOUNT), { signal: controller.signal });
         const data = await res.json();
         if (data?.response_code !== 0) return 0;
         results = data.results || [];
      } finally {
         clearTimeout(timer);
      }

      // Group by resolved WordUp category (science splits into physics/chemistry/biology)
      const grouped = new Map<string, CuratedQuestion[]>();
      for (const raw of results) {
         const q = normalizeOtdbResult(raw, cat);
         if (!q) continue;
         const list = grouped.get(q.category) || [];
         list.push(q);
         grouped.set(q.category, list);
      }

      let inserted = 0;
      for (const [category, questions] of grouped) {
         const { data, error } = await supabase.rpc("upsert_curated_otdb_questions", {
            p_category: category,
            p_questions: questions.map(({ prompt, answer, choices, difficulty }) => ({
               prompt,
               answer,
               choices,
               difficulty,
            })),
            p_ttl_days: CURATION_TTL_DAYS,
         });
         if (!error && data && typeof data.inserted === "number") inserted += data.inserted;
      }
      return inserted;
   } catch {
      return 0;
   } finally {
      inFlight = false;
   }
}
