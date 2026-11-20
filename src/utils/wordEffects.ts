export interface DmWordEffect {
   id: string;
   group_id: string;
   trigger_word: string;
   emoji: string;
   created_by: string;
   created_at: string;
}

export const MAX_WORD_EFFECTS_PER_DM = 25;
export const MAX_TRIGGER_WORD_LENGTH = 40;

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalizes a trigger word or short phrase: trims edges, collapses inner whitespace,
 * lowercases, and clamps to MAX_TRIGGER_WORD_LENGTH.
 */
export function normalizeTriggerWord(raw: string): string {
   return raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, MAX_TRIGGER_WORD_LENGTH);
}

/**
 * Extracts a clean single emoji grapheme (supports multi-codepoint ZWJ / flags / skin tones).
 */
export function normalizeEffectEmoji(raw: string): string {
   const trimmed = raw.trim();
   if (!trimmed) return "";

   // Use Intl.Segmenter when available to grab the first visual grapheme cluster
   if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      for (const { segment } of segmenter.segment(trimmed)) {
         if (segment.trim()) return segment.slice(0, 16);
      }
   }
   return Array.from(trimmed)[0] ?? "";
}

const SYSTEM_OR_PLACEHOLDER_PATTERNS = [
   /^\[reaction:.+\]$/i,
   /^\[poll:[a-zA-Z0-9-_]+\]$/i,
   /^\[Voice Message\]$/i,
   /^\[Image\]$/i,
];

/**
 * Matches a decrypted DM text message against the configured word effects.
 * - Longest trigger words are checked first (so "happy birthday" beats "happy").
 * - Uses whole-word boundaries for alphanumeric triggers so "cat" does not match "vacation".
 * - Falls back to whitespace/punctuation boundaries for non-ASCII or symbol triggers.
 */
export function matchWordEffect(
   messageText: string | null | undefined,
   effects: DmWordEffect[],
): DmWordEffect | null {
   if (!messageText || !effects || effects.length === 0) return null;

   const trimmed = messageText.trim();
   if (!trimmed) return null;
   if (SYSTEM_OR_PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed))) return null;

   // Sort longest triggers first without mutating caller's array
   const sorted = [...effects].sort(
      (a, b) => normalizeTriggerWord(b.trigger_word).length - normalizeTriggerWord(a.trigger_word).length,
   );

   const normalizedMessage = trimmed.replace(/\s+/g, " ");

   for (const effect of sorted) {
      const trigger = normalizeTriggerWord(effect.trigger_word);
      if (!trigger || !effect.emoji) continue;

      const escaped = escapeRegex(trigger);
      const startsAlphaNum = /^[a-z0-9]/i.test(trigger);
      const endsAlphaNum = /[a-z0-9]$/i.test(trigger);

      const leftBoundary = startsAlphaNum ? "\\b" : "(?:^|[\\s.,!?;:\"'()\\[\\]{}])";
      const rightBoundary = endsAlphaNum ? "\\b" : "(?:$|[\\s.,!?;:\"'()\\[\\]{}])";

      const regex = new RegExp(`${leftBoundary}${escaped}${rightBoundary}`, "i");
      if (regex.test(normalizedMessage)) {
         return effect;
      }
   }

   return null;
}
