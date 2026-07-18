import { type WordUpQuestion } from "./wordupQuestionGenerator";
import { FLAG_MAP } from "../wordup/shared/constants";

// Cache to hold preloaded flag image URLs so we don't have to resolve/re-verify them mid-game
const flagUrlCache: Record<string, string> = {};

// Tracks which general (non-flag) image URLs have been preloaded into browser cache
const preloadedUrls: Set<string> = new Set();

export const getPrimaryFlagUrl = (code: string) =>
   `https://flagcdn.com/${code.toLowerCase()}.svg`;
export const getFallbackFlagUrl = (code: string) =>
   `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${code.toLowerCase()}.svg`;

/**
 * Returns the cached flag URL or falls back to primary.
 */
export function getCachedFlagUrl(code: string): string {
   if (!code) return "";
   if (code.startsWith("http://") || code.startsWith("https://")) {
      return code;
   }
   const resolved = getFlagCode(code) || code;
   return flagUrlCache[resolved.toLowerCase()] || getPrimaryFlagUrl(resolved);
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
   // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
               throw new Error(
                  `Flag preloading failed for code: ${lowerCode} after all retries. ${err.message}`,
               );
            });
      });
}

/**
 * Preloads a single general (non-flag) image URL into the browser cache.
 */
function preloadGeneralImage(url: string): Promise<void> {
   if (preloadedUrls.has(url)) return Promise.resolve();
   return tryLoadImage(url, 2, 300).then(() => {
      preloadedUrls.add(url);
   });
}

/**
 * Preloads all unique images (both flag codes and full URLs) for the rounds in parallel.
 */
export async function preloadMatchImages(
   questions: WordUpQuestion[],
 ): Promise<void> {
    const flagCodes = new Set<string>();
    const generalUrls = new Set<string>();
 
    for (const q of questions) {
       if (q.imageUrl) {
          const resolved = getFlagCode(q.imageUrl);
          if (resolved && resolved.length === 2) {
             flagCodes.add(resolved);
          } else {
             generalUrls.add(q.imageUrl);
          }
       }
       if (q.imageUrls) {
          for (const entry of q.imageUrls) {
             if (entry) {
                const resolved = getFlagCode(entry);
                if (resolved && resolved.length === 2) {
                   flagCodes.add(resolved);
                } else {
                   generalUrls.add(entry);
                }
             }
          }
       }
    }
 
    const tasks: Promise<void>[] = [];
 
    if (flagCodes.size > 0) {
       tasks.push(
          ...Array.from(flagCodes).map((code) =>
             preloadFlagImage(code).catch((err) => console.warn(err)),
          ),
       );
    }
    if (generalUrls.size > 0) {
       tasks.push(
          ...Array.from(generalUrls).map((url) =>
             preloadGeneralImage(url).catch((err) => console.warn(err)),
          ),
       );
    }
 
    if (tasks.length === 0) return;
 
    await Promise.all(tasks);
 }
 
 /** @deprecated Use `preloadMatchImages` instead */
 export const preloadMatchFlags = preloadMatchImages;

 function decodeEntities(text: string): string {
    if (typeof document === "undefined" || !text) return text;
    const el = document.createElement("textarea");
    el.innerHTML = text;
    return el.value;
 }

 function decodeQuestion(q: WordUpQuestion): WordUpQuestion {
    const resolveWiki = (url: string | undefined | null): string | undefined => {
       if (!url) return undefined;
       if (url.startsWith("wikimedia:")) {
          const fileName = url.replace(/^wikimedia:File:/, "");
          return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
       }
       return url;
    };

    return {
       ...q,
       prompt: decodeEntities(q.prompt),
       subPrompt: q.subPrompt ? decodeEntities(q.subPrompt) : undefined,
       answer: decodeEntities(q.answer),
       choices: q.choices.map(decodeEntities),
       explanation: q.explanation ? decodeEntities(q.explanation) : undefined,
       imageUrl: q.imageUrl ? resolveWiki(q.imageUrl) : undefined,
       imageUrls: q.imageUrls ? q.imageUrls.map(resolveWiki) as string[] : undefined,
    };
 }
 
 export function postProcessQuestions(
    questions: WordUpQuestion[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _category: string,
 ): WordUpQuestion[] {
    return questions.map(decodeQuestion);
 }
