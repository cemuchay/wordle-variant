import { safeLocalStorage } from "../../utils/storage";

/**
 * Per-category ring buffer of recently played curated/handcrafted question IDs.
 * Works for guests too, and is sent to `generate-match-questions` as `excludeQuestionIds`
 * so back-to-back matches never repeat questions.
 */
export const RECENT_QIDS_PREFIX = "wordup_recent_qids_";
export const MAX_RECENT_QIDS = 40;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isQuestionUuid(id: unknown): id is string {
   return typeof id === "string" && UUID_RX.test(id);
}

export function getRecentQuestionIds(category: string): string[] {
   try {
      const raw = safeLocalStorage.getItem(RECENT_QIDS_PREFIX + category);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isQuestionUuid) : [];
   } catch {
      return [];
   }
}

export function addRecentQuestionIds(category: string, ids: unknown[]): string[] {
   const fresh = ids.filter(isQuestionUuid);
   if (fresh.length === 0) return getRecentQuestionIds(category);
   const merged = [...fresh, ...getRecentQuestionIds(category).filter((id) => !fresh.includes(id))].slice(
      0,
      MAX_RECENT_QIDS,
   );
   try {
      safeLocalStorage.setItem(RECENT_QIDS_PREFIX + category, JSON.stringify(merged));
   } catch {
      /* ignore */
   }
   return merged;
}

/** Extracts curated/handcrafted question IDs (UUIDs) from generated questions. */
export function extractQuestionIds(questions: Array<{ id?: unknown }> | null | undefined): string[] {
   return (questions || []).map((q) => q?.id).filter(isQuestionUuid);
}
