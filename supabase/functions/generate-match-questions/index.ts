import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

import { CATEGORY_SUPER_MAP } from "./types.ts";
import { getQuestionConfig } from "./questionConfig.ts";
import {
   createSeededRandom,
   seededShuffle,
   hashSeed,
   isNumeric,
   getNumericDistractors,
   getBelievableMisspelling,
} from "./utils.ts";
import { formatQuestionPrompt, cleanVal } from "./promptFormatter.ts";
import { generateMathsQuestion } from "./maths.ts";
import { generateEnglishQuestion } from "./english.ts";
import { getRandomMatchingTemplate, FAKE_BIBLE_BOOKS } from "./templates.ts";

// ── Crypto ───────────────────────────────────────────────────

async function generateSecureSessionKey(): Promise<string> {
   const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
   );
   const raw = await crypto.subtle.exportKey("raw", key);
   return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function encryptPayload(
   payload: string,
   base64Key: string,
): Promise<string> {
   const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
   const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
   );
   const iv = crypto.getRandomValues(new Uint8Array(12));
   const encoded = new TextEncoder().encode(payload);
   const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded,
   );
   const combined = new Uint8Array(iv.length + encrypted.byteLength);
   combined.set(iv, 0);
   combined.set(new Uint8Array(encrypted), iv.length);
   return btoa(String.fromCharCode(...combined));
}

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
};

// ── Generic entity-based question generator ──────────────────

const SKIP_KEYS = new Set([
   "_distractors",
   "_symbolDistractors",
   "_directorDistractors",
   "_entity_type",
   "id",
   "image",
   "images",
   "difficulty",
   "popularity",
   "aliases",
   "related",
   "facts",
   "primary_val",
   "secondary_val",
]);
const DEFAULT_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1];

function pickVariants(
   weights: number[],
   rng: () => number,
   count: number,
): number[] {
   const total = weights.reduce((a, b) => a + b, 0);
   const result: number[] = [];
   for (let i = 0; i < count; i++) {
      let variant: number;
      let attempts = 0;
      do {
         let roll = rng() * total;
         variant = 0;
         for (let v = 0; v < weights.length; v++) {
            roll -= weights[v];
            if (roll <= 0) {
               variant = v;
               break;
            }
         }
         attempts++;
      } while (i > 0 && variant === result[i - 1] && attempts < 10);
      result.push(variant);
   }
   return result;
}

function buildVariantTryOrder(
   assignedVariant: number,
   weights: number[],
): number[] {
   const others = weights
      .map((w, i) => ({ variant: i, weight: w }))
      .filter((item) => item.variant !== assignedVariant)
      .sort((a, b) => b.weight - a.weight);
   return [assignedVariant, ...others.map((o) => o.variant)];
}

function generateQuestion(
   seed: string,
   entity: any,
   allEntities: any[],
   variantOverride?: number,
   category?: string,
   variantWeights?: number[],
   customTemplates?: any[],
): any {
   const qObj = _generateQuestion(
      seed,
      entity,
      allEntities,
      variantOverride,
      category,
      variantWeights,
      customTemplates,
   );
   const meta = entity?.metadata || {};
   const rng = createSeededRandom(hashSeed(seed));

   // ── Misspelling distractor injection (15% chance for multiple choice) ──
   if (
      qObj &&
      qObj.choices &&
      qObj.choices.length >= 4 &&
      qObj.answer &&
      qObj.choices.includes(qObj.answer)
   ) {
      const isTrueFalse =
         qObj.choices.includes("True") && qObj.choices.includes("False");
      if (!isTrueFalse && rng() < 0.15) {
         const misspelled = getBelievableMisspelling(qObj.answer, rng);
         if (
            misspelled &&
            misspelled !== qObj.answer &&
            !qObj.choices.includes(misspelled)
         ) {
            const distractorIndices: number[] = [];
            for (let i = 0; i < qObj.choices.length; i++) {
               if (qObj.choices[i] !== qObj.answer) {
                  distractorIndices.push(i);
               }
            }
            if (distractorIndices.length > 0) {
               const idxToReplace =
                  distractorIndices[
                     Math.floor(rng() * distractorIndices.length)
                  ];
               qObj.choices[idxToReplace] = misspelled;
            }
         }
      }
   }

   if (meta.images && Array.isArray(meta.images) && meta.images.length > 0) {
      const imgIdx = Math.floor(rng() * meta.images.length);
      const chosenImage = meta.images[imgIdx];
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      qObj.imageUrl = chosenImage.startsWith("http")
         ? chosenImage
         : `${supabaseUrl}/storage/v1/object/public/wordup-questions/${chosenImage}`;
   } else if (meta.image) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      qObj.imageUrl = meta.image.startsWith("http")
         ? meta.image
         : `${supabaseUrl}/storage/v1/object/public/wordup-questions/${meta.image}`;
   } else if (meta.flag_code) {
      qObj.imageUrl = `https://flagcdn.com/h240/${meta.flag_code.toLowerCase()}.png`;
   }
   return qObj;
}

function censorWord(text: string, word: string): string {
   if (!text || !word) return text;
   const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
   const regex = new RegExp(`\\b${escaped}(s|es)?\\b`, "gi");
   return text.replace(regex, "_____");
}

function _generateQuestion(
   seed: string,
   entity: any,
   allEntities: any[],
   variantOverride?: number,
   category?: string,
   variantWeights?: number[],
   customTemplates?: any[],
): any {
   const rng = createSeededRandom(hashSeed(seed));
   const label = entity?.label || "Unknown";
   const meta = entity?.metadata || {};
   const categoryType = category || entity?.type || "";

   if (!entity || allEntities.length < 2) {
      return {
         type: "definition",
         prompt: `Identify: ${label}`,
         choices: [label, "Unknown", "None", "All"],
         answer: label,
         explanation: `The correct answer is "${label}".`,
      };
   }

   // ── Check if a handcrafted matrix template is available ──
   const template = getRandomMatchingTemplate(entity, categoryType, rng, customTemplates);
   if (template) {
      const promptPattern = seededShuffle(template.prompts, rng)[0];
      const explanationPattern = seededShuffle(template.explanations, rng)[0];

      const interpolate = (pattern: string) => {
         let result = pattern.replace(/{label}/g, label);
         // Also support type-name placeholders dynamically (e.g. {club}, {element})
         const entityTypeName = meta._entity_type;
         if (entityTypeName) {
            const rxType = new RegExp(`{${entityTypeName.toLowerCase()}}`, "g");
            result = result.replace(rxType, label);
         }
          template.requiredKeys.forEach((key) => {
             let val = cleanVal(String(meta[key] ?? ""));
             // Flip testament for NOT-in-testament questions
             if (template.id === "bible_not_in_testament" && key === "testament") {
                val = val === "Old" ? "New" : "Old";
             }
             if (
                key === "definition" ||
                key === "meaning" ||
                key === "example" ||
                key === "example_template" ||
                key === "idiom_meaning"
             ) {
                val = censorWord(val, label);
             }
             const rx = new RegExp(`{${key}}`, "g");
             result = result.replace(rx, val);
          });
         return result;
      };

      const promptText = interpolate(promptPattern);
       let explanationText = interpolate(explanationPattern);
      const answerKey = template.answerKey;
      let answerVal = label;
      let distValues: string[] = [];

      if (answerKey && meta[answerKey]) {
         answerVal = cleanVal(String(meta[answerKey]));
         distValues = allEntities
            .filter((e) => e.id !== entity.id && e.metadata?.[answerKey])
            .map((e) => cleanVal(String(e.metadata[answerKey])));
      } else {
         distValues = allEntities
            .filter((e) => {
               if (e.label === label) return false;
               // Exclude other entities that share the exact same key criteria value(s) to avoid double-correct options
               const isDuplicateMatch = template.requiredKeys.every((key) => {
                  return (
                     cleanVal(String(e.metadata?.[key] ?? "")) ===
                     cleanVal(String(meta[key] ?? ""))
                  );
               });
               return !isDuplicateMatch;
            })
            .map((e) => e.label);
      }

      let distractors = seededShuffle(
         [...new Set(distValues)].filter((v) => v !== answerVal),
         rng,
      ).slice(0, 3);

       // bible_real_book: use fake book names as distractors
       if (template.id === "bible_real_book") {
          distractors = seededShuffle(FAKE_BIBLE_BOOKS, rng).slice(0, 2);
       }

       // bible_fake_book: answer is a fake book, distractors are real books
       if (template.id === "bible_fake_book") {
          const fakeBook = seededShuffle(FAKE_BIBLE_BOOKS, rng)[0];
          answerVal = fakeBook;
          distractors = seededShuffle(
             allEntities.filter((e) => e.label !== label).map((e) => e.label),
             rng,
          ).slice(0, 3);
          explanationText = `"${fakeBook}" is not a real book of the Bible.`;
       }

      return {
         type: "definition",
         prompt: promptText,
         choices: seededShuffle([answerVal, ...distractors], rng),
         answer: answerVal,
         explanation: explanationText,
         imageUrl: entity.metadata?.image || undefined,
         imageUrls: entity.metadata?.images || undefined,
      };
   }

   // Localized Key Selection & Peer Filtering
   const availableKeys = Object.keys(meta).filter((k) => !SKIP_KEYS.has(k));
   if (availableKeys.length === 0) {
      const distractors = seededShuffle(
         allEntities.filter((e) => e.label !== label).map((e) => e.label),
         rng,
      ).slice(0, 3);
      const choices = seededShuffle(
         [...new Set([label, ...distractors])].slice(0, 4),
         rng,
      );
      return {
         type: "definition",
         prompt: `Which of the following is "${label}"?`,
         choices,
         answer: label,
         explanation: `The entity described is "${label}".`,
      };
   }

   const shuffledKeys = seededShuffle(availableKeys, rng);
   let chosenKey = "";
   let validDistractorPool: any[] = [];

   // Find a key shared by at least 3 other entities
   for (const key of shuffledKeys) {
      const peers = allEntities.filter(
         (e) =>
            e.id !== entity.id &&
            e.metadata?.[key] !== undefined &&
            String(e.metadata[key]).trim() !== "",
      );
      if (peers.length >= 3) {
         chosenKey = key;
         validDistractorPool = peers;
         break;
      }
   }

   // Fallback: Relax constraint to first available key and use any peer
   if (!chosenKey) {
      chosenKey = availableKeys[0];
      validDistractorPool = allEntities.filter((e) => e.id !== entity.id);
   }

   const correctValueRaw = String(meta[chosenKey] ?? "");
   let correctValue = cleanVal(correctValueRaw);
   if (
      chosenKey === "definition" ||
      chosenKey === "meaning" ||
      chosenKey === "example" ||
      chosenKey === "example_template" ||
      chosenKey === "idiom_meaning"
   ) {
      correctValue = censorWord(correctValue, label);
   }
   const keyLabel = chosenKey.replace(/_/g, " ");

   // Determine if we should generate numeric distractors
   const isNum = isNumeric(correctValue);
   let distractors: string[] = [];

   if (isNum) {
      distractors = getNumericDistractors(correctValue, rng).slice(0, 5);
   }

   // If not numeric, or we couldn't generate at least 5 numeric distractors, get from peers
   if (distractors.length < 5) {
      const otherValues = validDistractorPool
         .map((e) => {
            let val = cleanVal(String(e.metadata?.[chosenKey] ?? ""));
            if (
               chosenKey === "definition" ||
               chosenKey === "meaning" ||
               chosenKey === "example" ||
               chosenKey === "example_template" ||
               chosenKey === "idiom_meaning"
            ) {
               val = censorWord(val, e.label);
            }
            return val;
         })
         .filter((v) => v && v !== correctValue);
      const uniqueOtherValues = [...new Set(otherValues)];

      const peerDistractors = seededShuffle(uniqueOtherValues, rng);
      for (const dist of peerDistractors) {
         if (!distractors.includes(dist)) {
            distractors.push(dist);
         }
         if (distractors.length >= 5) break;
      }

      // If still not enough, pad with otherValues (including non-unique) or general fallback
      if (distractors.length < 5) {
         const nonUniquePeers = seededShuffle(otherValues, rng);
         for (const dist of nonUniquePeers) {
            if (!distractors.includes(dist)) {
               distractors.push(dist);
            }
            if (distractors.length >= 5) break;
         }
      }

      // Final fallback padding
      while (distractors.length < 5) {
         distractors.push(`Alternative ${label} Metric`);
      }
   }

   const entitiesWithDifferentValue = validDistractorPool
      .filter(
         (e) =>
            cleanVal(String(e.metadata?.[chosenKey] ?? "")) !== correctValue,
      )
      .map((e) => e.label)
      .filter((l) => l);

   const metaKeys = Object.keys(meta).filter((k) => !SKIP_KEYS.has(k));
   const weights = variantWeights ?? DEFAULT_WEIGHTS;
   const assignedVariant =
      variantOverride !== undefined
         ? variantOverride
         : Math.floor(rng() * weights.length);
   const tryOrder = buildVariantTryOrder(assignedVariant, weights);

   for (const v of tryOrder) {
      let q: any = null;

      // ── Variant 0: Forward ──────────────────────────────────
      if (v === 0 || distractors.length < 1) {
         const prompt = formatQuestionPrompt(
            0,
            label,
            chosenKey,
            correctValue,
            "",
            categoryType,
         );
         q = {
            type: "definition",
            prompt: prompt.prompt,
            choices: seededShuffle(
               [...new Set([correctValue, ...distractors])].slice(0, 4),
               rng,
            ),
            answer: correctValue,
            explanation: `"${label}" has a ${keyLabel} of "${correctValue}".`,
         };
         return q;
      }

      // ── Variant 1: Reverse ──────────────────────────────────
      if (v === 1 && entitiesWithDifferentValue.length >= 3) {
         const prompt = formatQuestionPrompt(
            1,
            label,
            chosenKey,
            correctValue,
            "",
            categoryType,
         );
         q = {
            type: "definition",
            prompt: prompt.prompt,
            choices: seededShuffle(
               [
                  ...new Set([
                     label,
                     ...seededShuffle(entitiesWithDifferentValue, rng),
                  ]),
               ].slice(0, 4),
               rng,
            ),
            answer: label,
            explanation: `"${label}" is the one with a ${keyLabel} of "${correctValue}".`,
         };
         return q;
      }

      // ── Variant 2: Odd one out ─────────────────────────────
      if (v === 2 && distractors.length >= 1) {
         const valueCounts = new Map<
            string,
            { count: number; labels: string[] }
         >();
         for (const e of allEntities) {
            if (e.id === entity?.id) continue;
            const val = cleanVal(String(e.metadata?.[chosenKey] ?? ""));
            if (!val) continue;
            if (!valueCounts.has(val))
               valueCounts.set(val, { count: 0, labels: [] });
            const entry = valueCounts.get(val)!;
            entry.count++;
            entry.labels.push(e.label);
         }
         const shared = Array.from(valueCounts.entries())
            .filter(
               ([val, info]) =>
                  val !== correctValue &&
                  info.count >= 3 &&
                  info.labels.length >= 3,
            )
            .sort(() => rng() - 0.5);
         if (shared.length > 0) {
            const [sharedValue, info] = shared[0];
            const cleanKeyLabel = keyLabel === "group" ? "field" : keyLabel;
            q = {
               type: "definition",
               prompt: `Which of these options does not share the same ${cleanKeyLabel} as the others?`,
               choices: seededShuffle(
                  [
                     ...new Set([
                        ...seededShuffle(info.labels, rng).slice(0, 3),
                        label,
                     ]),
                  ].slice(0, 4),
                  rng,
               ),
               answer: label,
               subPrompt: `The others are associated with the ${cleanKeyLabel} "${sharedValue}".`,
               explanation: `"${label}" is the odd one out — the others are in the ${cleanKeyLabel} "${sharedValue}".`,
            };
            return q;
         }
      }

      // ── Variant 3: True/False ─────────────────────────────
      if (v === 3 && distractors.length >= 1) {
         const isTrue = Math.floor(rng() * 2) === 0;
         const displayedValue = isTrue ? correctValue : distractors[0];
         const prompt = formatQuestionPrompt(
            3,
            label,
            chosenKey,
            correctValue,
            displayedValue,
            categoryType,
         );
         q = {
            type: "definition",
            prompt: prompt.prompt,
            choices: ["True", "False"],
            answer: isTrue ? "True" : "False",
            explanation: isTrue
               ? `"${label}" indeed has a ${keyLabel} of "${correctValue}".`
               : `"${label}" does not have a ${keyLabel} of "${displayedValue}" — its actual ${keyLabel} is "${correctValue}".`,
         };
         return q;
      }

      // ── Variant 4: Single-clue (What am I?) ────────────────
      if (
         v === 4 &&
         metaKeys.length >= 1 &&
         entitiesWithDifferentValue.length >= 3
      ) {
         const priorityKeys = [
            "definition",
            "meaning",
            "contrast",
            "formula",
            "achievement",
         ];
         let chosenClueKey = priorityKeys.find((k) => metaKeys.includes(k));
         if (!chosenClueKey) {
            chosenClueKey = seededShuffle(metaKeys, rng)[0];
         }

         const clueValRaw = String(meta[chosenClueKey] ?? "");
         let clueVal = clueValRaw;
         if (
            chosenClueKey === "definition" ||
            chosenClueKey === "meaning" ||
            chosenClueKey === "example" ||
            chosenClueKey === "example_template" ||
            chosenClueKey === "idiom_meaning"
         ) {
            clueVal = censorWord(clueVal, label);
         }
         const cLabel = chosenClueKey.replace(/_/g, " ").trim();
         const capitalizedClueLabel =
            cLabel.charAt(0).toUpperCase() + cLabel.slice(1);

         const isWordMatch =
            categoryType.includes("english") ||
            categoryType.includes("language") ||
            categoryType.includes("vocab");

         let promptText = "";
         if (chosenClueKey === "definition" || chosenClueKey === "meaning") {
            promptText = isWordMatch
               ? `Which word matches this definition:\n"${clueVal}"`
               : `Identify the match for this definition:\n"${clueVal}"`;
         } else {
            promptText = isWordMatch
               ? `Find the word that fits this clue:\n• ${capitalizedClueLabel}: ${clueVal}`
               : `Identify the match that fits this clue:\n• ${capitalizedClueLabel}: ${clueVal}`;
         }

         q = {
            type: "definition",
            prompt: promptText,
            choices: seededShuffle(
               [
                  ...new Set([
                     label,
                     ...seededShuffle(entitiesWithDifferentValue, rng),
                  ]),
               ].slice(0, 4),
               rng,
            ),
            answer: label,
            explanation: `"${label}" matches the clue (${cLabel}: "${clueVal}").`,
         };
         return q;
      }

      // ── Variant 5: Correct the error (TEMPORARILY DISABLED) ──
      if (v === 5 && false && distractors.length >= 1) {
         const wrongValue = distractors[0];
         const otherDistractors = distractors.filter((d) => d !== wrongValue);
         if (otherDistractors.length >= 3) {
            const prompt = formatQuestionPrompt(
               5,
               label,
               chosenKey,
               correctValue,
               wrongValue,
               categoryType,
            );
            q = {
               type: "definition",
               prompt: prompt.prompt,
               choices: seededShuffle(
                  [...new Set([correctValue, ...otherDistractors])].slice(0, 4),
                  rng,
               ),
               answer: correctValue,
               explanation: `"${label}" actually has a ${keyLabel} of "${correctValue}", not "${wrongValue}".`,
            };
            return q;
         }
      }

      // ── Variant 6: Tag Match (TEMPORARILY DISABLED) ───────
      if (v === 6 && false && entity.tags?.length > 0) {
         const allTags = [
            ...new Set(allEntities.flatMap((e: any) => e.tags || [])),
         ];
         const myTags: string[] = entity.tags;
         const otherTags = allTags.filter((t: string) => !myTags.includes(t));
         if (otherTags.length >= 3) {
            const tagCounts = new Map<string, number>();
            for (const e of allEntities) {
               for (const t of e.tags || []) {
                  tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
               }
            }
            const sortedTags = seededShuffle([...myTags], rng).sort(
               (a, b) => (tagCounts.get(a) || 0) - (tagCounts.get(b) || 0),
            );
            const chosenTag = sortedTags[0];
            const tagDistractors = seededShuffle(otherTags, rng).slice(0, 3);
            q = {
               type: "definition",
               prompt: `Which category best fits "${label}"?`,
               choices: seededShuffle([chosenTag, ...tagDistractors], rng),
               answer: chosenTag,
               explanation: `"${label}" belongs to the "${chosenTag}" category.`,
            };
            return q;
         }
      }

      // ── Variant 7: Compare (Numeric) ─────────────────────
      if (v === 7 && isNum) {
         const validPeers = allEntities.filter(
            (e: any) =>
               e.id !== entity.id &&
               e.metadata?.[chosenKey] !== undefined &&
               isNumeric(String(e.metadata[chosenKey])),
         );
         if (validPeers.length >= 1) {
            const peer = seededShuffle(validPeers, rng)[0];
            const sanitize = (val: string) =>
               val.replace(/[$,%\s]/g, "").replace(/,/g, "");
            const peerNum = parseFloat(
               sanitize(String(peer.metadata[chosenKey])),
            );
            const correctNum = parseFloat(sanitize(correctValue));
            if (
               !isNaN(correctNum) &&
               !isNaN(peerNum) &&
               correctNum !== peerNum
            ) {
               const isHigher = rng() > 0.5;
               const winner = isHigher
                  ? correctNum > peerNum
                     ? label
                     : peer.label
                  : correctNum < peerNum
                    ? label
                    : peer.label;
               const loser = winner === label ? peer.label : label;
               const winnerVal =
                  winner === label
                     ? correctValue
                     : String(peer.metadata[chosenKey] ?? "");
               const loserVal =
                  loser === label
                     ? correctValue
                     : String(peer.metadata[chosenKey] ?? "");
               q = {
                  type: "definition",
                  prompt: isHigher
                     ? `Which has a higher ${keyLabel}: "${label}" or "${peer.label}"?`
                     : `Which has a lower ${keyLabel}: "${label}" or "${peer.label}"?`,
                  choices: seededShuffle([label, peer.label], rng),
                  answer: winner,
                  explanation: `"${winner}" has a ${keyLabel} of ${winnerVal}, while "${loser}" has ${loserVal}.`,
               };
               return q;
            }
         }
      }

      // ── Variant 8: Timeline ──────────────────────────────
      if (v === 8 && isNum) {
         const k = chosenKey.toLowerCase();
         const isTime =
            k.includes("year") ||
            k.includes("date") ||
            k.includes("founded") ||
            k.includes("released") ||
            k.includes("created") ||
            k.includes("acquired");
         if (isTime) {
            const sanitize = (val: string) =>
               val.replace(/[$,%\s]/g, "").replace(/,/g, "");
            const candidates: { label: string; value: number }[] = [];
            for (const e of allEntities) {
               const raw = String(e.metadata?.[chosenKey] ?? "");
               const num = parseFloat(sanitize(raw));
               if (!isNaN(num)) {
                  candidates.push({ label: e.label, value: num });
               }
            }
            if (candidates.length >= 4) {
               candidates.sort((a, b) => a.value - b.value);
               const askEarliest = rng() > 0.5;
               const answer = askEarliest
                  ? candidates[0]
                  : candidates[candidates.length - 1];
               const timelineDistractors = seededShuffle(
                  candidates.filter((c) => c.label !== answer.label),
                  rng,
               )
                  .slice(0, 3)
                  .map((c) => c.label);
               q = {
                  type: "definition",
                  prompt: askEarliest
                     ? `Which of these happened earliest (${keyLabel})?`
                     : `Which of these happened most recently (${keyLabel})?`,
                  choices: seededShuffle(
                     [answer.label, ...timelineDistractors],
                     rng,
                  ),
                  answer: answer.label,
                  explanation: `"${answer.label}" is the ${askEarliest ? "earliest" : "most recent"} (${keyLabel}: ${answer.value}).`,
               };
               return q;
            }
         }
      }
   }
   const fallbackQ = formatQuestionPrompt(
      0,
      label,
      chosenKey,
      correctValue,
      "",
      categoryType,
   );
   return {
      type: "definition",
      prompt: fallbackQ.prompt,
      choices: seededShuffle(
         [...new Set([correctValue, ...distractors])].slice(0, 4),
         rng,
      ),
      answer: correctValue,
      explanation: `"${label}" has a ${keyLabel} of "${correctValue}".`,
   };
}

function resolveHandcraftedQuestion(hq: any, rng: () => number): any {
   let finalPrompt = hq.prompt;
   let finalAnswer = hq.answer;
   let finalChoices = hq.choices || [];
   let finalExplanation = hq.explanation;
   let finalImageUrl = hq.image_url;

   // If variations exist, resolve a variation
   if (hq.variations && Array.isArray(hq.variations) && hq.variations.length > 0) {
      const varIdx = Math.floor(rng() * hq.variations.length);
      const variation = hq.variations[varIdx];
      if (variation) {
         if (variation.params) {
            for (const [k, v] of Object.entries(variation.params)) {
               finalPrompt = finalPrompt.replace(new RegExp(`\\$\\{${k}\\}`, "g"), String(v));
               if (finalExplanation) {
                  finalExplanation = finalExplanation.replace(new RegExp(`\\$\\{${k}\\}`, "g"), String(v));
               }
            }
         }
         if (variation.answer) finalAnswer = variation.answer;
         if (variation.choices) finalChoices = variation.choices;
         if (variation.explanation) finalExplanation = variation.explanation;
         if (variation.image_url) finalImageUrl = variation.image_url;
      }
   }

   // Randomize options (limit to 4: correct + 3 wrong)
   const wrongChoices = finalChoices.filter((c: string) => c !== finalAnswer);
   const shuffledWrong = seededShuffle(wrongChoices, rng);
   const chosenWrong = shuffledWrong.slice(0, Math.min(3, shuffledWrong.length));
   const mergedChoices = [finalAnswer, ...chosenWrong];
   const shuffledFinalChoices = seededShuffle(mergedChoices, rng);

   return {
      type: "definition",
      id: hq.id,
      prompt: finalPrompt,
      choices: shuffledFinalChoices,
      answer: finalAnswer,
      explanation: finalExplanation,
      ...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
   };
}

// ── Main handler ─────────────────────────────────────────────

serve(async (req) => {
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   try {
      const { matchId, category, seed: clientSeed } = await req.json();

      if (!matchId || !category) {
         return new Response(
            JSON.stringify({ error: "matchId and category are required" }),
            {
               status: 400,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      const seed = clientSeed || `${matchId}-${category}`;
      const logPrefix = `[generate-match-questions]`;

      console.log(
         `${logPrefix} Starting for match=${matchId} category=${category} seed=${seed}`,
      );

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      // Idempotency check
      console.log(`${logPrefix} Checking existing match ${matchId}`);
      const { data: existing } = await supabaseClient
         .from("wordup_matches")
         .select(
            "questions, encryption_key, player1_id, player2_id, is_bot_match",
         )
         .eq("id", matchId)
         .single();

      if (existing?.questions && existing?.encryption_key) {
         return new Response(JSON.stringify({ matchId, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      // Gather player IDs to exclude/deprioritize seen entities
      const playerIds: string[] = [];
      if (existing?.player1_id) playerIds.push(existing.player1_id);
      if (existing?.player2_id && !existing.is_bot_match) {
         playerIds.push(existing.player2_id);
      }

       // Fetch category profile ratings and compute target difficulty
       let targetDifficulty = 3;
       let categoryRating = 600;
       try {
          const ratingResults = await Promise.all(
             playerIds.map((uid: string) =>
                supabaseClient.rpc("get_category_profile_rating", {
                   p_user_id: uid,
                   p_category: category,
                })
             )
          );
          const ratings = ratingResults
             .filter((r) => !r.error)
             .map((r) => Number(r.data ?? 600));
          categoryRating = ratings.length > 0 ? Math.min(...ratings) : 600;
           if (categoryRating < 700) targetDifficulty = 1;
          else if (categoryRating < 1100) targetDifficulty = 2;
          else if (categoryRating < 1400) targetDifficulty = 3;
          else if (categoryRating < 1700) targetDifficulty = 4;
          else targetDifficulty = 5;
       } catch {
          targetDifficulty = 3;
       }
        console.log(
           `${logPrefix} Category rating=${categoryRating} → target difficulty=${targetDifficulty}`,
        );

       // ── Entity fetch: unseen-first with pool-size fallback ──
       const stretchDifficultyMax = Math.min(5, targetDifficulty + 2);
       const COMFORT_LIMIT = 80;
       const STRETCH_LIMIT = 40;
       const MIN_ENTITY_POOL = 20;

       // Helper: fetch entities with given params, wrapped for resilience
       const fetchEntities = async (params: Record<string, any>): Promise<any[]> => {
          try {
             const { data, error } = await supabaseClient.rpc("get_wordup_entities_v2", params);
             if (error) {
                console.warn(`${logPrefix} Entity RPC error:`, error.message);
                return [];
             }
             return data || [];
          } catch (e: any) {
             console.warn(`${logPrefix} Entity RPC exception:`, e.message);
             return [];
          }
       };

       // First pass: try with p_exclude_seen (requires updated SQL)
       let comfortEntities = await fetchEntities({
          p_category: category,
          p_user_ids: playerIds,
          p_limit_per_type: COMFORT_LIMIT,
          p_difficulty_max: targetDifficulty,
          p_exclude_seen: true,
       });
       let stretchEntities = stretchDifficultyMax > targetDifficulty
          ? await fetchEntities({
               p_category: category,
               p_user_ids: playerIds,
               p_limit_per_type: STRETCH_LIMIT,
               p_difficulty_min: targetDifficulty,
               p_difficulty_max: stretchDifficultyMax,
               p_exclude_seen: true,
            })
          : [];

       // Dedup stretch against comfort
       stretchEntities = stretchEntities.filter(
          (e: any) => !comfortEntities.some((ce: any) => ce.id === e.id),
       );

       // If pool is too small, re-fetch without exclude_seen (includes seen entities, still sorted least-seen-first)
       const totalFirstPass = comfortEntities.length + stretchEntities.length;
       if (totalFirstPass < MIN_ENTITY_POOL) {
          console.log(
             `${logPrefix} Only ${totalFirstPass} unseen entities, widening pool with seen entities`,
          );
          const moreComfort = await fetchEntities({
             p_category: category,
             p_user_ids: playerIds,
             p_limit_per_type: COMFORT_LIMIT,
             p_difficulty_max: targetDifficulty,
          });
          const moreStretch = stretchDifficultyMax > targetDifficulty
             ? await fetchEntities({
                  p_category: category,
                  p_user_ids: playerIds,
                  p_limit_per_type: STRETCH_LIMIT,
                  p_difficulty_min: targetDifficulty,
                  p_difficulty_max: stretchDifficultyMax,
               })
             : [];

          // Merge: unseen first, then seen (deduped by id)
          const seenIds = new Set([
             ...comfortEntities.map((e: any) => e.id),
             ...stretchEntities.map((e: any) => e.id),
          ]);
          comfortEntities = [...comfortEntities, ...moreComfort.filter((e: any) => !seenIds.has(e.id))];
          stretchEntities = [...stretchEntities, ...moreStretch.filter((e: any) => !seenIds.has(e.id))];
       }

       // Mark each entity with its bucket origin for seen-count tracking
       const entityList: any[] = [
          ...comfortEntities.map((e: any) => ({ ...e, _bucket: "comfort" })),
          ...stretchEntities.map((e: any) => ({ ...e, _bucket: "stretch" })),
       ];

       console.log(
          `${logPrefix} Fetched ${entityList.length} total entities (${comfortEntities.length} comfort + ${stretchEntities.length} stretch) for category="${category}"`,
       );
       if (entityList.length > 0) {
          console.log(
             `${logPrefix} Entity sample:`,
             JSON.stringify(entityList.slice(0, 2)).substring(0, 300),
          );
       } else {
          console.warn(
             `${logPrefix} No entities returned from RPC — will fallback to procedural questions`,
          );
       }

        // Fetch active handcrafted questions with stats
       let handcraftedList: any[] = [];
       let userTopicSkill = 1500;
      try {
         // Fetch user skill for this topic (use minimum skill across players)
         try {
            const skillResults = await Promise.all(
               playerIds.map((uid: string) =>
                  supabaseClient.rpc("get_user_skill", {
                     p_user_id: uid,
                     p_topic_slug: category,
                  })
               )
            );
            const skills = skillResults
               .filter((r) => !r.error)
               .map((r) => Number(r.data ?? 1500));
            userTopicSkill = skills.length > 0 ? Math.min(...skills) : 1500;
         } catch {
            userTopicSkill = 1500;
         }

          // Compute difficulty range around target
          const diffMin = Math.max(1, targetDifficulty - 1);
          const diffMax = Math.min(5, targetDifficulty + 1);
          const MIN_HANDCRAFTED_POOL = 10;

          // Step 1: Find question IDs that BOTH players have seen (to exclude them)
          let bothSeenIds: string[] = [];
          if (playerIds.length >= 2) {
             try {
                const { data: seenData } = await supabaseClient
                   .from("wordup_user_handcrafted_history")
                   .select("question_id, user_id")
                   .in("user_id", playerIds);

                if (seenData) {
                   // Group by question_id, find questions seen by ALL players
                   const seenByQuestion = new Map<string, Set<string>>();
                   for (const row of seenData) {
                      if (!seenByQuestion.has(row.question_id)) {
                         seenByQuestion.set(row.question_id, new Set());
                      }
                      seenByQuestion.get(row.question_id)!.add(row.user_id);
                   }
                   for (const [qid, users] of seenByQuestion) {
                      if (playerIds.every((uid) => users.has(uid))) {
                         bothSeenIds.push(qid);
                      }
                   }
                }
             } catch (e: any) {
                console.warn(`${logPrefix} Could not fetch both-seen IDs:`, e.message);
             }
          }
          console.log(
             `${logPrefix} Both players have seen ${bothSeenIds.length} handcrafted questions — excluding from primary pool`,
          );

          // Step 2: Fetch handcrafted questions, excluding both-seen
          let hcQuery = supabaseClient
            .from("wordup_handcrafted_questions")
            .select(`
               id,
               prompt,
               choices,
               answer,
               explanation,
               variations,
               image_url,
               difficulty,
               history:wordup_user_handcrafted_history(user_id, seen_at),
               stats:wordup_question_stats(difficulty_elo, topic_elo)
            `)
            .eq("category", category)
            .or("expires_at.is.null,expires_at.gt.now()");

          // Exclude both-seen if we found any
          if (bothSeenIds.length > 0) {
             hcQuery = hcQuery.not("id", "in", `(${bothSeenIds.join(",")})`);
          }

          let { data: hcData, error: hcError } = await hcQuery;

          // Step 3: Widen difficulty range if pool is too small
          if (!hcError && (hcData || []).length < MIN_HANDCRAFTED_POOL) {
             console.log(
                `${logPrefix} Only ${(hcData || []).length} unseen handcrafted, widening difficulty range`,
             );
             const { data: wideData } = await supabaseClient
               .from("wordup_handcrafted_questions")
               .select(`
                  id,
                  prompt,
                  choices,
                  answer,
                  explanation,
                  variations,
                  image_url,
                  difficulty,
                  history:wordup_user_handcrafted_history(user_id, seen_at),
                  stats:wordup_question_stats(difficulty_elo, topic_elo)
               `)
               .eq("category", category)
               .or("expires_at.is.null,expires_at.gt.now()");

             if (wideData) {
                const currentIds = new Set((hcData || []).map((q: any) => q.id));
                const additional = wideData.filter((q: any) => !currentIds.has(q.id));
                hcData = [...(hcData || []), ...additional];
             }
          }

         if (hcError) {
            console.warn(
               `${logPrefix} Error fetching handcrafted questions:`,
               hcError,
            );
         } else {
              const enriched = (hcData || []).map((hq: any) => {
                 const playerHistory = (hq.history || []).filter((h: any) => playerIds.includes(h.user_id));
                 const seenUsers = new Set(playerHistory.map((h: any) => h.user_id));
                 const seenCount = seenUsers.size;
                 const difficulty = hq.difficulty ?? 3;
                 const topicElo = hq.stats?.topic_elo ?? 1500;
                 const diffScore = Math.abs(topicElo - userTopicSkill);
                 const difficultyProximity = Math.abs(difficulty - targetDifficulty);
                 // seenStatus: "none" = unseen by both, "some" = seen by 1, "all" = seen by all
                 let seenStatus: "none" | "some" | "all" = "none";
                 if (seenCount >= playerIds.length) seenStatus = "all";
                 else if (seenCount > 0) seenStatus = "some";
                 return {
                    id: hq.id,
                    prompt: hq.prompt,
                    choices: hq.choices,
                    answer: hq.answer,
                    explanation: hq.explanation,
                    variations: hq.variations,
                    image_url: hq.image_url,
                    difficulty,
                    seenCount,
                    seenStatus,
                    diffScore,
                    topicElo,
                    difficultyProximity,
                 };
              });

             // Tiered bucket: neither → one → both, sorted by difficulty proximity first, then diffScore
             const buckets = { neither: [] as any[], one: [] as any[], both: [] as any[] };
             for (const hq of enriched) {
                if (hq.seenCount === 0) buckets.neither.push(hq);
                else if (hq.seenCount < playerIds.length) buckets.one.push(hq);
                else buckets.both.push(hq);
             }
             for (const key of ["neither", "one", "both"] as const) {
                buckets[key].sort((a, b) => {
                   const dp = a.difficultyProximity - b.difficultyProximity;
                   return dp !== 0 ? dp : a.diffScore - b.diffScore;
                });
             }

             handcraftedList = [
                ...buckets.neither,
                ...buckets.one,
                ...buckets.both,
             ];
         }
      } catch (e: any) {
         console.warn(`${logPrefix} Handcrafted query exception:`, e.message);
      }
      console.log(
         `${logPrefix} Fetched ${handcraftedList.length} active handcrafted questions (user skill=${userTopicSkill})`,
      );

      // Fetch custom templates for this topic from DB
      let dbTemplatesList: any[] = [];
      const queryCategory = (category === "element_arena" || category === "periodic-table" || category === "periodic_table") ? "chemistry" : category;
      try {
         const { data: qTemplates, error: qTemplatesError } = await supabaseClient
            .from("question_templates")
            .select(`
               id,
               answer_key,
               required_keys,
               prompts,
               explanations,
               topics!inner(slug)
            `)
            .eq("topics.slug", queryCategory);

         if (qTemplatesError) {
            console.warn(`${logPrefix} Error fetching question templates:`, qTemplatesError);
         } else {
            dbTemplatesList = (qTemplates || []).map((t: any) => ({
               id: t.id,
               category: category,
               answerKey: t.answer_key,
               requiredKeys: t.required_keys,
               prompts: t.prompts,
               explanations: t.explanations,
            }));
         }
      } catch (e: any) {
         console.warn(`${logPrefix} Question templates query exception:`, e.message);
      }
      console.log(
         `${logPrefix} Fetched ${dbTemplatesList.length} database question templates`,
      );

      const matchRng = createSeededRandom(hashSeed(seed));
      const shuffledHandcrafted = seededShuffle(handcraftedList, matchRng);
      let handcraftedCursor = 0;

      const config = getQuestionConfig(category);

      // Weighted variant selection from config
      const variantSequence = pickVariants(config.variantWeights, matchRng, 7);

      // Shuffle comfort entities first (priority), then stretch for variety
      const comfortPool = entityList.filter((e: any) => e._bucket === "comfort");
      const stretchPool = entityList.filter((e: any) => e._bucket === "stretch");
      const shuffledComfort = seededShuffle(comfortPool, matchRng);
      const shuffledStretch = seededShuffle(stretchPool, matchRng);
      const shuffledEntities = [...shuffledComfort, ...shuffledStretch];
      let entityCursor = 0;

      const chosenEntities: any[] = [];
      const usedIds = new Set<string>();
      const questions: any[] = [];
      let matchSeenCount = 0;
      const MATCH_SEEN_CAP = 2;
      let difficulty1Count = 0;
      const DIFFICULTY1_CAP = 3;

      const isDifficulty1Capped = (e: any) =>
         (e.difficulty || 1) <= 1 && difficulty1Count >= DIFFICULTY1_CAP;

      // Returns the next unseen entity (total_seen === 0) from the pool
      const getNextUnseenEntity = (): any => {
         if (shuffledEntities.length === 0) return null;
         const startCursor = entityCursor;
         const total = shuffledEntities.length;
         for (let attempt = 0; attempt < total; attempt++) {
            const e = shuffledEntities[entityCursor % total];
            entityCursor++;
            if (!usedIds.has(e.id) && (e.total_seen || 0) === 0 && !isDifficulty1Capped(e)) {
               usedIds.add(e.id);
               return e;
            }
            if (entityCursor - startCursor >= total) break;
         }
         return null;
      };

      const getNextEntity = (): any => {
         if (shuffledEntities.length === 0) return null;
         const attempts = shuffledEntities.length * 2;
         for (let attempt = 0; attempt < attempts; attempt++) {
            const e = shuffledEntities[entityCursor % shuffledEntities.length];
            entityCursor++;
            if (!usedIds.has(e.id) && !isDifficulty1Capped(e)) {
               usedIds.add(e.id);
               return e;
            }
         }
         const e = shuffledEntities[entityCursor % shuffledEntities.length];
         entityCursor++;
         return e;
      };

      const generatedPrompts = new Set<string>();
      const chosenHandcraftedIds: string[] = [];

      for (let i = 0; i < 7; i++) {
         const attempts = 5;
         let q: any = null;
         let chosenEntity: any = null;
         let hqChosen: any = null;

         for (let attempt = 0; attempt < attempts; attempt++) {
            const roundSeed = attempt === 0 ? `${seed}-${i}` : `${seed}-${i}-retry-${attempt}`;
            const roundRng = createSeededRandom(hashSeed(roundSeed));
            const variant = variantSequence[i] ?? 0;

             const baseWeave = config.handcraftedWeaveProbability ?? 0.4;
             // Beginners get more handcrafted questions, advanced get more procedural
             const weaveProb = baseWeave * (1.5 - targetDifficulty * 0.15);

            // ── Mix Strategy: Weave unexpired handcrafted questions from DB ──
            // Handcrafted questions are always higher quality than procedural — prefer them
            if (
               shuffledHandcrafted.length > handcraftedCursor &&
               roundRng() < weaveProb
            ) {
               const isValidHq = (s: any) =>
                  s && s.prompt && s.choices && s.choices.length >= 2;

               // Walk forward to find a valid, non-duplicate handcrafted question
               let hq = shuffledHandcrafted[handcraftedCursor];
               handcraftedCursor++;
               while (
                  handcraftedCursor < shuffledHandcrafted.length &&
                  (!isValidHq(hq) || generatedPrompts.has(hq.prompt.trim().toLowerCase()))
               ) {
                  hq = shuffledHandcrafted[handcraftedCursor];
                  handcraftedCursor++;
               }

               // If current candidate is invalid, scan the full list for any valid unseen
               if (!isValidHq(hq) || generatedPrompts.has(hq.prompt.trim().toLowerCase())) {
                  let found = false;
                  for (let j = 0; j < shuffledHandcrafted.length; j++) {
                     const candidate = shuffledHandcrafted[j];
                     if (isValidHq(candidate) && !generatedPrompts.has(candidate.prompt.trim().toLowerCase())) {
                        hq = candidate;
                        found = true;
                        break;
                     }
                  }
                  if (!found) q = null; // truly no valid handcrafted — fall through to procedural
               }

               if (q === null && isValidHq(hq) && !generatedPrompts.has(hq.prompt.trim().toLowerCase())) {
                  q = resolveHandcraftedQuestion(hq, roundRng);
                  if (hq.seenStatus !== "none") {
                     matchSeenCount++;
                  }
                  chosenEntity = null;
                  hqChosen = hq;
               }
            }

            // Procedural paths (if handcrafted didn't produce a question)
            if (!q) {
               if (category === "maths") {
                  // When under seen cap, prefer unseen entities
                  chosenEntity = matchSeenCount < MATCH_SEEN_CAP
                     ? (entityList.length > 0 ? getNextUnseenEntity() || getNextEntity() : null)
                     : (entityList.length > 0 ? getNextEntity() : null);
                  q = generateMathsQuestion(
                     roundSeed,
                     chosenEntity,
                     entityList,
                     roundRng,
                     variant,
                     config.proceduralWeight,
                  );
                  hqChosen = null;
               } else if (category === "english_language") {
                  chosenEntity = matchSeenCount < MATCH_SEEN_CAP
                     ? (entityList.length > 0 ? getNextUnseenEntity() || getNextEntity() : null)
                     : (entityList.length > 0 ? getNextEntity() : null);
                  q = generateEnglishQuestion(
                     roundSeed,
                     chosenEntity,
                     entityList,
                     roundRng,
                     variant,
                     config.proceduralWeight,
                  );
                  if (!q && chosenEntity) {
                     q = generateQuestion(
                        roundSeed,
                        chosenEntity,
                        entityList,
                        variant,
                        category,
                        config.variantWeights,
                        dbTemplatesList,
                     );
                  }
                  hqChosen = null;
               } else {
                   // Standard entity-based procedural category logic
                   if (entityList.length === 0) {
                      if (shuffledHandcrafted.length > 0) {
                         const isValidHq = (s: any) =>
                            s && s.prompt && s.choices && s.choices.length >= 2;
                         let fallbackHq: any = null;
                         for (let j = 0; j < shuffledHandcrafted.length; j++) {
                            const candidate = shuffledHandcrafted[(handcraftedCursor + j) % shuffledHandcrafted.length];
                            if (isValidHq(candidate) && !generatedPrompts.has(candidate.prompt.trim().toLowerCase())) {
                               fallbackHq = candidate;
                               handcraftedCursor = (handcraftedCursor + j + 1) % shuffledHandcrafted.length;
                               break;
                            }
                         }
                         if (fallbackHq) {
                            q = resolveHandcraftedQuestion(fallbackHq, roundRng);
                            if (fallbackHq.seenStatus !== "none") {
                               matchSeenCount++;
                            }
                            hqChosen = fallbackHq;
                         } else {
                            q = generateMathsQuestion(
                               roundSeed,
                               null,
                               [],
                               roundRng,
                               variant,
                               config.proceduralWeight,
                            );
                            hqChosen = null;
                         }
                      } else {
                         q = generateMathsQuestion(
                            roundSeed,
                            null,
                            [],
                            roundRng,
                            variant,
                            config.proceduralWeight,
                         );
                         hqChosen = null;
                      }
                      chosenEntity = null;
                  } else {
                     chosenEntity = matchSeenCount < MATCH_SEEN_CAP
                        ? getNextUnseenEntity() || getNextEntity()
                        : getNextEntity();
                     q = generateQuestion(
                        roundSeed,
                        chosenEntity,
                        entityList,
                        variant,
                        category,
                        config.variantWeights,
                        dbTemplatesList,
                     );
                     hqChosen = null;
                  }
               }
            }

            if (q) {
               const cleanedPrompt = q.prompt.trim().toLowerCase();
               // Allow duplicates only if we run out of unique entities to prevent infinite loops
                if (!generatedPrompts.has(cleanedPrompt) || shuffledEntities.length <= questions.length) {
                   generatedPrompts.add(cleanedPrompt);
                   if (chosenEntity) {
                      // Track seen count for entities
                      if ((chosenEntity.total_seen || 0) > 0) {
                         matchSeenCount++;
                      }
                      // Track difficulty 1 usage for cap
                      if ((chosenEntity.difficulty || 1) <= 1) {
                         difficulty1Count++;
                      }
                      chosenEntities.push(chosenEntity);
                   }
                  if (hqChosen && hqChosen.id) {
                     chosenHandcraftedIds.push(hqChosen.id);
                  }
                  break;
               } else {
                  // Revert entity mapping and seen count for duplicate prompts
                  if (chosenEntity) {
                     usedIds.delete(chosenEntity.id);
                     if ((chosenEntity.total_seen || 0) > 0) {
                        matchSeenCount = Math.max(0, matchSeenCount - 1);
                     }
                  }
                  if (hqChosen && hqChosen.seenStatus !== "none") {
                     matchSeenCount = Math.max(0, matchSeenCount - 1);
                  }
                  q = null;
                  hqChosen = null;
               }
            }
         }

         if (q) {
            questions.push(q);
            console.log(
               `${logPrefix} Round ${i}: question generated successfully (prompt="${q.prompt}")`,
            );
         } else {
            console.warn(`${logPrefix} Round ${i}: failed to generate any unique question`);
         }
      }

      console.log(`${logPrefix} Generated ${questions.length} questions total (seen in match: ${matchSeenCount}/${MATCH_SEEN_CAP} cap)`);
      console.log(
         `${logPrefix} Chosen entities:`,
         chosenEntities.filter(Boolean).map((e: any) => `${e.label} (seen:${e.total_seen || 0})`),
      );

      // Encrypt and persist
      const plaintext = JSON.stringify(questions);
      console.log(
         `${logPrefix} Plaintext payload length: ${plaintext.length} chars`,
      );
      const encryptionKey = await generateSecureSessionKey();
      console.log(
         `${logPrefix} Encryption key generated (${encryptionKey.length} chars)`,
      );
      const encryptedQuestions = await encryptPayload(plaintext, encryptionKey);
      console.log(
         `${logPrefix} Payload encrypted (${encryptedQuestions.length} chars)`,
      );

      console.log(
         `${logPrefix} Updating wordup_matches ${matchId} with questions and encryption_key`,
      );
      const { error: updateError } = await supabaseClient
         .from("wordup_matches")
         .update({
            questions: encryptedQuestions,
            encryption_key: encryptionKey,
         })
         .eq("id", matchId)
         .is("questions", null);

      if (updateError) {
         console.error(`${logPrefix} DB update error:`, updateError);
         console.log(
            `${logPrefix} Falling back to wordup_match_payloads insert`,
         );
         const { error: payloadError } = await supabaseClient
            .from("wordup_match_payloads")
            .insert({
               match_id: matchId,
               encrypted_payload: encryptedQuestions,
            });
         if (payloadError) {
            throw new Error(`Failed to store payload: ${payloadError.message}`);
         }
         console.log(`${logPrefix} Payload stored in wordup_match_payloads`);
      } else {
         console.log(`${logPrefix} Match updated successfully`);

         // Log the chosen entities in the user history table for tracking
         const validChosenEntityIds = chosenEntities
            .filter((e) => e && e.id)
            .map((e) => e.id);

         if (validChosenEntityIds.length > 0 && playerIds.length > 0) {
            console.log(
               `${logPrefix} Recording entity history for ${playerIds.length} user(s)`,
            );
            const { error: historyError } = await supabaseClient.rpc(
               "record_user_entities_seen",
               {
                  p_user_ids: playerIds,
                  p_entity_ids: validChosenEntityIds,
               },
            );

            if (historyError) {
               console.error(
                  `${logPrefix} Failed to record entity history:`,
                  historyError,
               );
            } else {
               console.log(`${logPrefix} Entity history recorded`);
            }
         }

         // Log the chosen handcrafted questions in the user history table for tracking
         if (chosenHandcraftedIds.length > 0 && playerIds.length > 0) {
            console.log(
               `${logPrefix} Recording handcrafted history for ${playerIds.length} user(s)`,
            );
            const { error: hcHistoryError } = await supabaseClient.rpc(
               "record_user_handcrafted_seen",
               {
                  p_user_ids: playerIds,
                  p_question_ids: chosenHandcraftedIds,
               },
            );

            if (hcHistoryError) {
               console.error(
                  `${logPrefix} Failed to record handcrafted history:`,
                  hcHistoryError,
               );
            } else {
               console.log(`${logPrefix} Handcrafted history recorded`);
            }
         }
      }

      console.log(`${logPrefix} Returning success response`);
      return new Response(
         JSON.stringify({
            matchId,
            encryptedQuestions,
            encryptionKey,
            questionCount: questions.length,
         }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
   } catch (err: any) {
      console.error("[generate-match-questions] Error:", err);
      return new Response(
         JSON.stringify({ error: err.message || "Internal error" }),
         {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         },
      );
   }
});
