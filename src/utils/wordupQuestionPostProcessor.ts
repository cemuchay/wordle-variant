import { type WordUpQuestion } from "./wordupQuestionGenerator";
import { FLAG_MAP } from "../components/wordup/WordUpView/constants";

// Cache to hold preloaded image URLs so we don't have to resolve/re-verify them mid-game
const flagUrlCache: Record<string, string> = {};

export const getPrimaryFlagUrl = (code: string) => `https://flagcdn.com/${code.toLowerCase()}.svg`;
export const getFallbackFlagUrl = (code: string) => `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${code.toLowerCase()}.svg`;

/**
 * Returns the cached flag URL or falls back to primary.
 */
export function getCachedFlagUrl(code: string): string {
   return flagUrlCache[code.toLowerCase()] || getPrimaryFlagUrl(code);
}

/**
 * Normalizes a country name and resolves it to a flag code.
 */
export function getFlagCode(name: string): string | null {
   if (!name) return null;
   const normalized = name.toLowerCase().trim();
   if (normalized.length === 2) return normalized;
   return FLAG_MAP[normalized] || null;
}

/**
 * Converts a flag code back to a capitalized country name.
 */
export function getCountryName(code: string): string {
   const lower = code.toLowerCase();
   const entry = Object.entries(FLAG_MAP).find(([_, v]) => v === lower);
   if (entry) {
      return entry[0]
         .split(" ")
         .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
         .join(" ");
   }
   return code.toUpperCase();
}

function tryLoadImage(url: string, retries = 3, delay = 500): Promise<void> {
   return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const load = () => {
         const img = new Image();
         img.onload = () => resolve();
         img.onerror = () => {
            attempts++;
            if (attempts < retries) {
               setTimeout(load, delay);
            } else {
               reject(new Error(`Failed to load ${url}`));
            }
         };
         img.src = url;
      };
      load();
   });
}

/**
 * Preloads a single flag image using parallel/sequential fallback checks.
 */
export function preloadFlagImage(code: string): Promise<void> {
   const lowerCode = code.toLowerCase();
   if (flagUrlCache[lowerCode]) return Promise.resolve();

   const primaryUrl = getPrimaryFlagUrl(lowerCode);
   const fallbackUrl = getFallbackFlagUrl(lowerCode);

   return tryLoadImage(primaryUrl, 3, 500)
      .then(() => {
         flagUrlCache[lowerCode] = primaryUrl;
      })
      .catch(() => {
         return tryLoadImage(fallbackUrl, 3, 500)
            .then(() => {
               flagUrlCache[lowerCode] = fallbackUrl;
            })
            .catch((err) => {
               throw new Error(`Flag preloading failed for code: ${lowerCode} after all retries. ${err.message}`);
            });
      });
}

/**
 * Preloads all unique flag codes for the rounds in parallel.
 */
export async function preloadMatchFlags(questions: WordUpQuestion[]): Promise<void> {
   const codes = new Set<string>();
   for (const q of questions) {
      if (q.imageUrl && q.imageUrl.length === 2) {
         codes.add(q.imageUrl);
      }
      if (q.imageUrls) {
         for (const code of q.imageUrls) {
            if (code && code.length === 2) {
               codes.add(code);
            }
         }
      }
   }

   if (codes.size === 0) return;

   // Preload all in parallel and resolve
   await Promise.all(Array.from(codes).map((code) => preloadFlagImage(code)));
}

/**
 * Post-processes questions client-side to convert textual flag bearer prompts
 * into image-rich visual question formats.
 */
export function postProcessQuestions(questions: WordUpQuestion[], category: string): WordUpQuestion[] {
   if (category !== "flag_bearer") return questions;

   return questions.map((q) => {
      // Create a shallow copy
      const processed: WordUpQuestion = { ...q };

      // 1. Is this a choices-are-flag-codes question? (Variant 0 or 5 for flag_code key)
      const choicesAreCodes = q.choices.every((choice) => {
         const code = getFlagCode(choice);
         return code !== null && code.length === 2;
      });

      if (choicesAreCodes && q.choices.length > 1) {
         const targetCode = getFlagCode(q.answer) || q.answer;
         const countryName = getCountryName(targetCode);

         processed.prompt = `Identify the flag of ${countryName}:`;
         processed.imageUrls = q.choices.map((c) => getFlagCode(c) || c);
         // Keep processed.choices and answer as the codes so they match client-side selections,
         // but the BattleView UI will render the images using the corresponding code indices.
         return processed;
      }

      // 2. Is this a True/False flag matching question?
      const isTrueFalse = q.choices.length === 2 && q.choices.includes("True") && q.choices.includes("False");
      if (isTrueFalse) {
         // Attempt to find country name and flag code in prompt
         let countryName = "";
         let countryCode: string | null = null;

         for (const [name, code] of Object.entries(FLAG_MAP)) {
            const regex = new RegExp(`\\b${name}\\b`, "i");
            if (regex.test(q.prompt)) {
               countryName = name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
               countryCode = code;
               break;
            }
         }

         // Look for code mentioned in prompt (e.g. 'ng' or 'fr')
         let mentionedCode = countryCode;
         const codeMatches = q.prompt.match(/'([a-z]{2})'/i);
         if (codeMatches && codeMatches[1]) {
            mentionedCode = codeMatches[1].toLowerCase();
         }

         if (countryName && mentionedCode) {
            processed.prompt = `True or False: This is the flag of ${countryName}.`;
            processed.imageUrl = mentionedCode;
            return processed;
         }
      }

      // 3. Choices are country names (Variant 1 for flag_code, or general matching)
      const answerCode = getFlagCode(q.answer);
      if (answerCode) {
         processed.prompt = "Which country does this flag belong to?";
         processed.imageUrl = answerCode;
         return processed;
      }

      // 4. Fallback visual clues for other questions (e.g. capitals, colors)
      // If we find the country name anywhere in the prompt or answer, attach its flag
      for (const [name, code] of Object.entries(FLAG_MAP)) {
         const regex = new RegExp(`\\b${name}\\b`, "i");
         if (regex.test(q.prompt) || regex.test(q.answer)) {
            processed.imageUrl = code;
            break;
         }
      }

      return processed;
   });
}
