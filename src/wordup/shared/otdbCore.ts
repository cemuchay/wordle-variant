// Pure, runtime-agnostic Open Trivia DB helpers (no Deno / browser globals).
// Mirror of supabase/functions/_shared/otdbCore.ts (Edge Functions) — keep in sync.

export interface OtdbCategory {
   id: number;
   internal: string; // WordUp category slug; "science" is classified per-question
}

export const OTDB_CATEGORIES: OtdbCategory[] = [
   { id: 18, internal: "computers" },
   { id: 21, internal: "sports" },
   { id: 19, internal: "maths" },
   { id: 22, internal: "geography" },
   { id: 23, internal: "history" },
   { id: 9, internal: "general_knowledge" },
   { id: 14, internal: "television" },
   { id: 15, internal: "video_games" },
   { id: 11, internal: "movies" },
   { id: 12, internal: "music" },
   { id: 27, internal: "animals" },
   { id: 17, internal: "science" },
];

export const SCIENCE_TARGETS = ["physics", "chemistry", "biology"];

export interface OtdbRawResult {
   question: string;
   correct_answer: string;
   incorrect_answers: string[];
   difficulty?: string;
}

export interface CuratedQuestion {
   category: string;
   prompt: string;
   answer: string;
   choices: string[];
   difficulty: "easy" | "medium" | "hard";
}

export function decodeOtdb(value: string): string {
   if (!value) return "";
   try {
      return decodeURIComponent(value).trim();
   } catch {
      return value.trim();
   }
}

export function fisherYatesShuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
   const out = [...arr];
   for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
   }
   return out;
}

const CHEM_RX = /\b(chemistry|chemical|element|atom|atomic|molecule|compound|acid|periodic|isotope|ion|reaction)\b/i;
const BIO_RX = /\b(biology|cell|gene|genetic|dna|rna|organism|plant|species|protein|bacteria|virus|anatomy|blood|bone|organ)\b/i;

export function classifyScience(prompt: string): string {
   if (CHEM_RX.test(prompt)) return "chemistry";
   if (BIO_RX.test(prompt)) return "biology";
   return "physics";
}

export function resolveInternalCategory(cat: OtdbCategory, prompt: string): string {
   return cat.internal === "science" ? classifyScience(prompt) : cat.internal;
}

export function normalizeOtdbResult(
   raw: OtdbRawResult,
   cat: OtdbCategory,
   rand: () => number = Math.random,
): CuratedQuestion | null {
   const prompt = decodeOtdb(raw.question);
   const answer = decodeOtdb(raw.correct_answer);
   if (!prompt || !answer) return null;
   const distractors = (raw.incorrect_answers || [])
      .map(decodeOtdb)
      .filter((c) => c && c !== answer);
   const unique = Array.from(new Set([answer, ...distractors])).slice(0, 4);
   if (unique.length < 2) return null;
   const d = (raw.difficulty || "medium").toLowerCase();
   return {
      category: resolveInternalCategory(cat, prompt),
      prompt,
      answer,
      choices: fisherYatesShuffle(unique, rand),
      difficulty: d === "easy" || d === "hard" ? d : "medium",
   };
}

export function difficultyToInt(d: string): number {
   return d === "easy" ? 1 : d === "hard" ? 5 : 3;
}

export function buildOtdbUrl(categoryId: number, amount: number, token?: string): string {
   return `https://opentdb.com/api.php?amount=${amount}&category=${categoryId}&type=multiple&encode=url3986${token ? `&token=${token}` : ""}`;
}

/** Returns the OTDB category feeding a WordUp topic slug (science topics share id 17). */
export function otdbCategoryForTopic(slug: string): OtdbCategory | null {
   if (SCIENCE_TARGETS.includes(slug)) return OTDB_CATEGORIES.find((c) => c.id === 17) || null;
   return OTDB_CATEGORIES.find((c) => c.internal === slug) || null;
}
