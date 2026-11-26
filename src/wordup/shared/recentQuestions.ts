import { safeLocalStorage } from "../../utils/storage";

/**
 * Per-category ring buffers of recently played curated/handcrafted question IDs,
 * entity IDs, and normalized prompt keys.
 * Works for guests too, and is sent to `generate-match-questions` as `excludeQuestionIds`
 * / `excludeEntityIds` so back-to-back matches never repeat questions.
 */
export const RECENT_QIDS_PREFIX = "wordup_recent_qids_";
export const MAX_RECENT_QIDS = 40;

export const RECENT_EIDS_PREFIX = "wordup_recent_eids_";
export const MAX_RECENT_EIDS = 40;

export const RECENT_PROMPTS_PREFIX = "wordup_recent_prompts_";
export const MAX_RECENT_PROMPTS = 40;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isQuestionUuid(id: unknown): id is string {
   return typeof id === "string" && UUID_RX.test(id);
}

function getRingBuffer(prefix: string, category: string, filterFn: (v: unknown) => v is string): string[] {
   try {
      const raw = safeLocalStorage.getItem(prefix + category);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(filterFn) : [];
   } catch {
      return [];
   }
}

function addToRingBuffer(
   prefix: string,
   category: string,
   fresh: string[],
   maxLen: number,
   filterFn: (v: unknown) => v is string,
): string[] {
   if (fresh.length === 0) return getRingBuffer(prefix, category, filterFn);
   const uniqueFresh = Array.from(new Set(fresh));
   const existing = getRingBuffer(prefix, category, filterFn);
   const merged = [...uniqueFresh, ...existing.filter((item) => !uniqueFresh.includes(item))].slice(0, maxLen);
   try {
      safeLocalStorage.setItem(prefix + category, JSON.stringify(merged));
   } catch {
      /* ignore */
   }
   return merged;
}

export function getRecentQuestionIds(category: string): string[] {
   return getRingBuffer(RECENT_QIDS_PREFIX, category, isQuestionUuid);
}

export function addRecentQuestionIds(category: string, ids: unknown[]): string[] {
   return addToRingBuffer(
      RECENT_QIDS_PREFIX,
      category,
      ids.filter(isQuestionUuid),
      MAX_RECENT_QIDS,
      isQuestionUuid,
   );
}

/** Extracts curated/handcrafted question IDs (UUIDs) from generated questions. */
export function extractQuestionIds(questions: Array<{ id?: unknown }> | null | undefined): string[] {
   return (questions || []).map((q) => q?.id).filter(isQuestionUuid);
}

export function getRecentEntityIds(category: string): string[] {
   return getRingBuffer(RECENT_EIDS_PREFIX, category, isQuestionUuid);
}

export function addRecentEntityIds(category: string, ids: unknown[]): string[] {
   return addToRingBuffer(
      RECENT_EIDS_PREFIX,
      category,
      ids.filter(isQuestionUuid),
      MAX_RECENT_EIDS,
      isQuestionUuid,
   );
}

/** Extracts entity IDs (UUIDs) from generated questions. */
export function extractEntityIds(questions: Array<{ entityId?: unknown }> | null | undefined): string[] {
   return (questions || []).map((q) => q?.entityId).filter(isQuestionUuid);
}

export function normalizePromptKey(prompt: unknown): string | null {
   if (typeof prompt !== "string") return null;
   const normalized = prompt.trim().toLowerCase().replace(/\s+/g, " ");
   return normalized.length > 0 ? normalized : null;
}

function isNonEmptyString(v: unknown): v is string {
   return typeof v === "string" && v.length > 0;
}

export function getRecentPrompts(category: string): string[] {
   return getRingBuffer(RECENT_PROMPTS_PREFIX, category, isNonEmptyString);
}

export function addRecentPrompts(category: string, prompts: unknown[]): string[] {
   const fresh = prompts.map(normalizePromptKey).filter((k): k is string => k !== null);
   return addToRingBuffer(
      RECENT_PROMPTS_PREFIX,
      category,
      fresh,
      MAX_RECENT_PROMPTS,
      isNonEmptyString,
   );
}

/** Extracts normalized prompt keys from generated questions. */
export function extractPromptKeys(questions: Array<{ prompt?: unknown }> | null | undefined): string[] {
   return (questions || [])
      .map((q) => normalizePromptKey(q?.prompt))
      .filter((k): k is string => k !== null);
}
