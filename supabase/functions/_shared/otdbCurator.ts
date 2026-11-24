// Shared, non-blocking Open Trivia DB curator for Supabase Edge Functions.
// Safe to run alongside other scheduled work: never throws, hard time-boxed.
import {
   OTDB_CATEGORIES,
   SCIENCE_TARGETS,
   buildOtdbUrl,
   difficultyToInt,
   normalizeOtdbResult,
   type CuratedQuestion,
   type OtdbCategory,
} from "./otdbCore.ts";

export interface OtdbCurationOptions {
   maxCategories?: number; // categories fetched per run (OTDB allows ~1 req / 5s per IP)
   amountPerCategory?: number;
   ttlDays?: number;
   timeoutMs?: number;
   categoryIds?: number[]; // force specific OTDB categories
   log?: (msg: string) => void;
}

export interface OtdbCurationResult {
   inserted: number;
   deleted: number;
   categories: string[];
   errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pickCategories(
   supabase: any,
   maxCategories: number,
   forced?: number[],
): Promise<OtdbCategory[]> {
   if (forced && forced.length > 0) {
      return OTDB_CATEGORIES.filter((c) => forced.includes(c.id)).slice(0, maxCategories);
   }

   // Only curate for topics that are active and not suspended
   let activeSlugs: Set<string> | null = null;
   try {
      const { data } = await supabase
         .from("topics")
         .select("slug, is_active, is_suspended");
      if (Array.isArray(data) && data.length > 0) {
         activeSlugs = new Set(
            data.filter((t: any) => t.is_active !== false && !t.is_suspended).map((t: any) => t.slug),
         );
      }
   } catch { /* fall back to all */ }

   const eligible = OTDB_CATEGORIES.filter((c) => {
      if (!activeSlugs) return true;
      if (c.internal === "science") return SCIENCE_TARGETS.some((s) => activeSlugs!.has(s));
      return activeSlugs.has(c.internal);
   });

   // Prioritize the most depleted categories (fewest unexpired curated questions)
   const counts = new Map<string, number>();
   try {
      const { data } = await supabase
         .from("wordup_handcrafted_questions")
         .select("category")
         .eq("source", "opentdb")
         .gt("expires_at", new Date().toISOString())
         .limit(5000);
      for (const row of data || []) {
         counts.set(row.category, (counts.get(row.category) || 0) + 1);
      }
   } catch { /* ignore */ }

   const scoreOf = (c: OtdbCategory) =>
      c.internal === "science"
         ? Math.min(...SCIENCE_TARGETS.map((s) => counts.get(s) || 0))
         : counts.get(c.internal) || 0;

   return eligible
      .map((c) => ({ c, score: scoreOf(c) + Math.random() * 5 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, maxCategories)
      .map((x) => x.c);
}

async function curate(supabase: any, opts: Required<Omit<OtdbCurationOptions, "categoryIds">> & { categoryIds?: number[] }, signal: AbortSignal): Promise<OtdbCurationResult> {
   const result: OtdbCurationResult = { inserted: 0, deleted: 0, categories: [], errors: [] };
   const categories = await pickCategories(supabase, opts.maxCategories, opts.categoryIds);
   const expiresAt = new Date(Date.now() + opts.ttlDays * 86_400_000).toISOString();

   for (let i = 0; i < categories.length; i++) {
      if (signal.aborted) break;
      const cat = categories[i];
      try {
         const res = await fetch(buildOtdbUrl(cat.id, opts.amountPerCategory), { signal });
         const data = await res.json();
         if (data.response_code !== 0) {
            result.errors.push(`otdb ${cat.id} code ${data.response_code}`);
         } else {
            const normalized = (data.results || [])
               .map((r: any) => normalizeOtdbResult(r, cat))
               .filter(Boolean) as CuratedQuestion[];

            const records = normalized.map((q) => ({
               category: q.category,
               prompt: q.prompt,
               choices: q.choices,
               answer: q.answer,
               explanation: `The correct answer is "${q.answer}".`,
               difficulty: difficultyToInt(q.difficulty),
               source: "opentdb",
               expires_at: expiresAt,
            }));

            if (records.length > 0) {
               // ignoreDuplicates: never overwrite permanent handcrafted rows sharing a prompt
               const { error } = await supabase
                  .from("wordup_handcrafted_questions")
                  .upsert(records, { onConflict: "prompt", ignoreDuplicates: true });
               if (error) result.errors.push(`upsert ${cat.internal}: ${error.message}`);
               else {
                  result.inserted += records.length;
                  result.categories.push(cat.internal);
               }
            }
         }
      } catch (e: any) {
         result.errors.push(`fetch ${cat.internal}: ${e?.message || e}`);
      }
      // OpenTDB rate limit: 1 request per 5 seconds per IP
      if (i < categories.length - 1 && !signal.aborted) await sleep(5_100);
   }

   try {
      const { data, error } = await supabase.rpc("cleanup_expired_curated_questions", {
         p_max_age_days: opts.ttlDays,
      });
      if (error) result.errors.push(`cleanup: ${error.message}`);
      else result.deleted = Number(data || 0);
   } catch (e: any) {
      result.errors.push(`cleanup: ${e?.message || e}`);
   }

   return result;
}

/** Runs curation; resolves (never rejects) within `timeoutMs`. */
export async function runOtdbCuration(
   supabase: any,
   options: OtdbCurationOptions = {},
): Promise<OtdbCurationResult> {
   const opts = {
      maxCategories: options.maxCategories ?? 2,
      amountPerCategory: options.amountPerCategory ?? 25,
      ttlDays: options.ttlDays ?? 30,
      timeoutMs: options.timeoutMs ?? 20_000,
      log: options.log ?? ((m: string) => console.log(m)),
      categoryIds: options.categoryIds,
   };
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
   try {
      const res = await curate(supabase, opts, controller.signal);
      opts.log(
         `[otdbCurator] inserted=${res.inserted} deleted=${res.deleted} categories=${res.categories.join(",")}${res.errors.length ? ` errors=${res.errors.join(" | ")}` : ""}`,
      );
      return res;
   } catch (e: any) {
      opts.log(`[otdbCurator] failed: ${e?.message || e}`);
      return { inserted: 0, deleted: 0, categories: [], errors: [String(e?.message || e)] };
   } finally {
      clearTimeout(timer);
   }
}

/**
 * Fire-and-forget curation that does not delay the caller's response.
 * Uses EdgeRuntime.waitUntil when available so the isolate stays alive after responding.
 */
export function runOtdbCurationInBackground(
   supabase: any,
   options: OtdbCurationOptions = {},
): Promise<OtdbCurationResult> {
   const promise = runOtdbCuration(supabase, options);
   try {
      const er = (globalThis as any).EdgeRuntime;
      if (er && typeof er.waitUntil === "function") er.waitUntil(promise);
   } catch { /* ignore */ }
   return promise;
}
