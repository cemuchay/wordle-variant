import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ── Crypto ───────────────────────────────────────────────────

async function generateSecureSessionKey(): Promise<string> {
   const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"],
   );
   const raw = await crypto.subtle.exportKey("raw", key);
   return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function encryptPayload(payload: string, base64Key: string): Promise<string> {
   const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
   const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
   const iv = crypto.getRandomValues(new Uint8Array(12));
   const encoded = new TextEncoder().encode(payload);
   const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
   const combined = new Uint8Array(iv.length + encrypted.byteLength);
   combined.set(iv, 0);
   combined.set(new Uint8Array(encrypted), iv.length);
   return btoa(String.fromCharCode(...combined));
}

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Seeded PRNG ──────────────────────────────────────────────

function createSeededRandom(seed: number): () => number {
   let s = seed;
   return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967296;
   };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
   const result = [...arr];
   for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
   }
   return result;
}

function hashSeed(str: string): number {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
   }
   return Math.abs(hash);
}

function smartFakeAnswers(correct: number, rng: () => number): number[] {
   const candidates = [
      correct + 1, correct - 1, correct + 2, correct - 2,
      correct + 5, correct - 5, correct + 10, correct - 10,
      Math.floor(correct * 0.9), Math.ceil(correct * 1.1),
   ].filter((x) => x >= 0 && x !== correct);
   return [...new Set(candidates)].sort(() => rng() - 0.5).slice(0, 3);
}

// ── Generic entity-based question generator ──────────────────
// Works with ANY entity shape. No switch per category needed.
// To add a new category: just insert entities into wordup_entities.
// No edge function code changes required.

const SKIP_KEYS = new Set(["_distractors", "_symbolDistractors", "_directorDistractors", "id", "image"]);

function isNumeric(str: string): boolean {
   const cleanStr = str.replace(/[$,%\s]/g, "").replace(/,/g, "");
   if (!cleanStr) return false;
   return !isNaN(Number(cleanStr));
}

function getNumericDistractors(correctValueStr: string, rng: () => number): string[] {
   const cleanStr = correctValueStr.replace(/[$,%\s]/g, "").replace(/,/g, "");
   const correct = parseFloat(cleanStr);
   if (isNaN(correct)) return [];

   const hasPercent = correctValueStr.includes("%");
   const hasDollar = correctValueStr.includes("$");
   const formatVal = (val: number) => {
      let s = String(val);
      if (hasPercent) s += "%";
      if (hasDollar) s = "$" + s;
      return s;
   };

   // Detect if it is likely a year (integer in [1000, 2100], and no dollar/percent symbol)
   const isYear = Number.isInteger(correct) && correct >= 1000 && correct <= 2100 && !hasPercent && !hasDollar;

   const candidates: number[] = [];
   if (isYear) {
      const offsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25];
      for (const offset of offsets) {
         candidates.push(correct + offset);
      }
   } else {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(correct) || 1)));
      const offsets = [
         magnitude, -magnitude,
         magnitude * 0.5, -magnitude * 0.5,
         magnitude * 0.2, -magnitude * 0.2,
         magnitude * 0.1, -magnitude * 0.1,
         magnitude * 0.05, -magnitude * 0.05,
      ];
      for (const offset of offsets) {
         candidates.push(correct + offset);
         candidates.push(correct - offset);
      }
      candidates.push(correct * 0.9);
      candidates.push(correct * 1.1);
      candidates.push(correct * 0.8);
      candidates.push(correct * 1.2);
   }

   const uniqueCandidates = [...new Set(candidates)]
      .map((x) => {
         if (Number.isInteger(correct)) {
            return Math.round(x);
         }
         return parseFloat(x.toFixed(2));
      })
      .filter((x) => x !== correct && x >= 0)
      .map(formatVal);

   return seededShuffle(uniqueCandidates, rng);
}

function formatQuestionPrompt(
   variant: number,
   label: string,
   key: string,
   correctValue: string,
   displayOrWrongValue: string,
): { prompt: string } {
   const keyLabel = key.replace(/_/g, " ").trim();
   const k = key.toLowerCase();
   
   // English vocabulary overrides
   if (k === "synonym" || k === "antonym" || k === "definition") {
      if (variant === 0) {
         if (k === "synonym") return { prompt: `Which of the following is a synonym of the word "${label}"?` };
         if (k === "antonym") return { prompt: `Which of the following is an antonym of the word "${label}"?` };
         return { prompt: `What is the definition of the word "${label}"?` };
      }
      if (variant === 1) {
         if (k === "synonym") return { prompt: `Which of these words is a synonym of "${correctValue}"?` };
         if (k === "antonym") return { prompt: `Which of these words is an antonym of "${correctValue}"?` };
         return { prompt: `Which of these words means "${correctValue}"?` };
      }
      if (variant === 3) {
         if (k === "synonym") return { prompt: `True or False: A synonym of "${label}" is "${displayOrWrongValue}".` };
         if (k === "antonym") return { prompt: `True or False: The opposite (antonym) of "${label}" is "${displayOrWrongValue}".` };
         return { prompt: `True or False: "${label}" is defined as "${displayOrWrongValue}".` };
      }
      if (variant === 5) {
         if (k === "synonym") return { prompt: `The word "${label}" does NOT mean "${displayOrWrongValue}". What is its correct synonym?` };
         if (k === "antonym") return { prompt: `The opposite of "${label}" is NOT "${displayOrWrongValue}". What is its correct antonym?` };
         return { prompt: `The word "${label}" is NOT defined as "${displayOrWrongValue}". What is its correct definition?` };
      }
   }

   // Concept overrides: example, famous_for, contrast
   if (k === "example" || k === "famous_for" || k === "contrast") {
      if (variant === 0) {
         if (k === "example") return { prompt: `Which of the following is an example of "${label}"?` };
         if (k === "famous_for") return { prompt: `What is "${label}" famously known for?` };
         return { prompt: `What concept directly contrasts with "${label}"?` };
      }
      if (variant === 1) {
         if (k === "example") return { prompt: `Which concept has "${correctValue}" as an example?` };
         if (k === "famous_for") return { prompt: `Which of these options is famously known for "${correctValue}"?` };
         return { prompt: `Which concept contrasts with "${correctValue}"?` };
      }
      if (variant === 3) {
         if (k === "example") return { prompt: `True or False: An example of "${label}" is "${displayOrWrongValue}".` };
         if (k === "famous_for") return { prompt: `True or False: "${label}" is famously known for "${displayOrWrongValue}".` };
         return { prompt: `True or False: "${label}" contrasts with "${displayOrWrongValue}".` };
      }
      if (variant === 5) {
         if (k === "example") return { prompt: `"${displayOrWrongValue}" is NOT a correct example of "${label}". What is?` };
         if (k === "famous_for") return { prompt: `"${label}" is NOT famously known for "${displayOrWrongValue}". What is the correct fact?` };
         return { prompt: `"${label}" does NOT contrast with "${displayOrWrongValue}". What concept does?` };
      }
   }

   const isLoc = k === "country" || k === "continent" || k === "location" || k === "city" || k === "state" || k === "capital";
   const isTime = k.includes("year") || k.includes("date") || k.includes("founded") || k.includes("released") || k.includes("created") || k.includes("acquired");
   
   // Person/Author Inference
   const isPerson = k.includes("author") || k.includes("director") || k.includes("founder") || 
                    k.includes("singer") || k.includes("artist") || k.includes("creator") || 
                    k.includes("written") || k.includes("developer") || k.includes("inventor");
   
   let personAction = "create";
   let personVerb = "created by";
   if (k.includes("author") || k.includes("written")) { personAction = "write"; personVerb = "written by"; }
   else if (k.includes("director")) { personAction = "direct"; personVerb = "directed by"; }
   else if (k.includes("founder")) { personAction = "found"; personVerb = "founded by"; }
   else if (k.includes("singer") || k.includes("artist")) { personAction = "perform/sing"; personVerb = "performed by"; }
   else if (k.includes("inventor")) { personAction = "invent"; personVerb = "invented by"; }

   let verb = "done";
   if (k.includes("founded")) verb = "founded";
   else if (k.includes("established")) verb = "established";
   else if (k.includes("released")) verb = "released";
   else if (k.includes("published")) verb = "published";
   else if (k.includes("created")) verb = "created";
   else if (k.includes("acquired")) verb = "acquired";
   else if (k.includes("born")) verb = "born";
   else if (k.includes("died")) verb = "died";

   // Variant 0: Forward
   if (variant === 0) {
      if (isPerson) {
         if (personAction === "write") return { prompt: `Who wrote ${label}?` };
         if (personAction === "direct") return { prompt: `Who directed the movie ${label}?` };
         if (personAction === "found") return { prompt: `Who founded ${label}?` };
         if (personAction === "perform/sing") return { prompt: `Who performed/sang ${label}?` };
         if (personAction === "invent") return { prompt: `Who invented ${label}?` };
         return { prompt: `Who created ${label}?` };
      }
      if (isLoc) {
         if (k === "capital") return { prompt: `What is the capital of ${label}?` };
         return { prompt: `Which ${keyLabel} is ${label} located in?` };
      }
      if (isTime) {
         if (k.includes("birth") || k.includes("born")) return { prompt: `In what year was ${label} born?` };
         if (k.includes("death") || k.includes("died")) return { prompt: `In what year did ${label} die?` };
         if (verb !== "done") return { prompt: `In what year was ${label} ${verb}?` };
         return { prompt: `In what year was ${label} ${keyLabel}?` };
      }
      return { prompt: `What is the ${keyLabel} of ${label}?` };
   }

   // Variant 1: Reverse
   if (variant === 1) {
      if (isPerson) {
         return { prompt: `Which of these options was ${personVerb} ${correctValue}?` };
      }
      if (isLoc) {
         if (k === "capital") return { prompt: `Which of these has ${correctValue} as its capital?` };
         return { prompt: `Which of these options is located in ${correctValue}?` };
      }
      if (isTime && verb !== "done") {
         return { prompt: `Which of these options was ${verb} in ${correctValue}?` };
      }
      return { prompt: `Which of these options has the ${keyLabel} "${correctValue}"?` };
   }

   // Variant 3: True / False
   if (variant === 3) {
      if (isPerson) {
         return { prompt: `True or False: ${label} was ${personVerb} ${displayOrWrongValue}.` };
      }
      if (isLoc) {
         if (k === "capital") return { prompt: `True or False: The capital of ${label} is ${displayOrWrongValue}.` };
         return { prompt: `True or False: ${label} is located in ${displayOrWrongValue}.` };
      }
      if (isTime && verb !== "done") {
         return { prompt: `True or False: ${label} was ${verb} in ${displayOrWrongValue}.` };
      }
      return { prompt: `True or False: The ${keyLabel} of ${label} is "${displayOrWrongValue}".` };
   }

   // Variant 5: Correct the error
   if (variant === 5) {
      if (isPerson) {
         if (personAction === "write") return { prompt: `${label} was NOT written by ${displayOrWrongValue}. Who is the correct author?` };
         if (personAction === "direct") return { prompt: `${label} was NOT directed by ${displayOrWrongValue}. Who actually directed it?` };
         if (personAction === "found") return { prompt: `${label} was NOT founded by ${displayOrWrongValue}. Who actually founded it?` };
         if (personAction === "perform/sing") return { prompt: `${label} was NOT performed by ${displayOrWrongValue}. Who actually performed it?` };
         if (personAction === "invent") return { prompt: `${label} was NOT invented by ${displayOrWrongValue}. Who actually invented it?` };
         return { prompt: `${label} was NOT created by ${displayOrWrongValue}. Who actually created it?` };
      }
      if (isLoc) {
         if (k === "capital") return { prompt: `The capital of ${label} is NOT ${displayOrWrongValue}. What is the correct capital?` };
         return { prompt: `${label} is NOT located in ${displayOrWrongValue}. Which ${keyLabel} is it actually in?` };
      }
      if (isTime && verb !== "done") {
         return { prompt: `${label} was NOT ${verb} in ${displayOrWrongValue}. What is the correct year?` };
      }
      return { prompt: `The statement "${label}'s ${keyLabel} is ${displayOrWrongValue}" is incorrect. What is the correct ${keyLabel}?` };
   }

   return { prompt: `What is the ${keyLabel} of ${label}?` };
}

function generateQuestion(seed: string, entity: any, allEntities: any[], variantOverride?: number): any {
   const qObj = _generateQuestion(seed, entity, allEntities, variantOverride);
   const meta = entity?.metadata || {};
   if (meta.image) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      qObj.imageUrl = `${supabaseUrl}/storage/v1/object/public/wordup-questions/${meta.image}`;
   }
   return qObj;
}

function _generateQuestion(seed: string, entity: any, allEntities: any[], variantOverride?: number): any {
   const rng = createSeededRandom(hashSeed(seed));
   const label = entity?.label || "Unknown";
   const meta = entity?.metadata || {};
   const difficulty = entity?.difficulty || 3;

   if (!entity || allEntities.length < 2) {
      return {
         type: "definition",
         prompt: `Identify: ${label}`,
         choices: [label, "Unknown", "None", "All"],
         answer: label,
      };
   }

   // Localized Key Selection & Peer Filtering
   const availableKeys = Object.keys(meta).filter((k) => !SKIP_KEYS.has(k));
   if (availableKeys.length === 0) {
      const distractors = seededShuffle(
         allEntities.filter((e) => e.label !== label).map((e) => e.label), rng,
      ).slice(0, 3);
      const choices = seededShuffle([...new Set([label, ...distractors])].slice(0, 4), rng);
      return { type: "definition", prompt: `Which of the following is "${label}"?`, choices, answer: label };
   }

   const shuffledKeys = seededShuffle(availableKeys, rng);
   let chosenKey = "";
   let validDistractorPool: any[] = [];

   // Find a key shared by at least 3 other entities
   for (const key of shuffledKeys) {
      const peers = allEntities.filter(
         (e) => e.id !== entity.id && e.metadata?.[key] !== undefined && String(e.metadata[key]).trim() !== ""
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

   const correctValue = String(meta[chosenKey] ?? "");
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
         .map((e) => String(e.metadata?.[chosenKey] ?? ""))
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
      .filter((e) => String(e.metadata?.[chosenKey] ?? "") !== correctValue)
      .map((e) => e.label)
      .filter((l) => l);

   const metaKeys = Object.keys(meta).filter((k) => !SKIP_KEYS.has(k));
   const variant = variantOverride !== undefined ? variantOverride : Math.floor(rng() * 6); // 0-5

   // ── Variant 0: Forward ──────────────────────────────────
   if (variant === 0 || distractors.length < 1) {
      const q = formatQuestionPrompt(0, label, chosenKey, correctValue, "");
      return {
         type: "definition",
         prompt: q.prompt,
         choices: seededShuffle([...new Set([correctValue, ...distractors])].slice(0, 4), rng),
         answer: correctValue,
      };
   }

   // ── Variant 1: Reverse ──────────────────────────────────
   if (variant === 1 && entitiesWithDifferentValue.length >= 3) {
      const q = formatQuestionPrompt(1, label, chosenKey, correctValue, "");
      return {
         type: "definition",
         prompt: q.prompt,
         choices: seededShuffle([...new Set([label, ...seededShuffle(entitiesWithDifferentValue, rng)])].slice(0, 4), rng),
         answer: label,
      };
   }

   // ── Variant 2: Odd one out ─────────────────────────────
   if (variant === 2 && distractors.length >= 1) {
      const valueCounts = new Map<string, { count: number; labels: string[] }>();
      for (const e of allEntities) {
         if (e.id === entity?.id) continue;
         const v = String(e.metadata?.[chosenKey] ?? "");
         if (!v) continue;
         if (!valueCounts.has(v)) valueCounts.set(v, { count: 0, labels: [] });
         const entry = valueCounts.get(v)!;
         entry.count++;
         entry.labels.push(e.label);
      }
      const shared = Array.from(valueCounts.entries())
         .filter(([v, info]) => v !== correctValue && info.count >= 3 && info.labels.length >= 3)
         .sort(() => rng() - 0.5);
      if (shared.length > 0) {
         const [sharedValue, info] = shared[0];
         return {
            type: "definition",
            prompt: `Which of these options does not share the same ${keyLabel} as the others?`,
            choices: seededShuffle([...new Set([...seededShuffle(info.labels, rng).slice(0, 3), label])].slice(0, 4), rng),
            answer: label,
            subPrompt: `The others have the ${keyLabel} "${sharedValue}".`,
         };
      }
   }

   // ── Variant 3: True/False ─────────────────────────────
   if (variant === 3 && distractors.length >= 1) {
      const isTrue = Math.floor(rng() * 2) === 0;
      const displayedValue = isTrue ? correctValue : distractors[0];
      const q = formatQuestionPrompt(3, label, chosenKey, correctValue, displayedValue);
      return {
         type: "definition",
         prompt: q.prompt,
         choices: ["True", "False"],
         answer: isTrue ? "True" : "False",
      };
   }

   // ── Variant 4: Multi-clue (What am I?) ────────────────
   if (variant === 4 && metaKeys.length >= 2 && entitiesWithDifferentValue.length >= 3) {
      const clueKeys = seededShuffle(metaKeys, rng).slice(0, Math.min(3, metaKeys.length));
      const clueParts: string[] = [];
      const usedKeys = new Set<string>();
      
      // Combine country and continent if both present
      if (clueKeys.includes("country") && clueKeys.includes("continent")) {
         const countryVal = meta["country"];
         const continentVal = meta["continent"];
         clueParts.push(`Located in ${countryVal} (${continentVal})`);
         usedKeys.add("country");
         usedKeys.add("continent");
      }

      clueKeys.forEach((key: string) => {
         if (usedKeys.has(key)) return;
         const v = String(meta[key] ?? "");
         const keyLabel = key.replace(/_/g, " ").trim();
         const k = key.toLowerCase();
         const isTime = k.includes("year") || k.includes("date") || k.includes("founded") || k.includes("released") || k.includes("created") || k.includes("acquired");
         
         let verb = "done";
         if (k.includes("founded")) verb = "founded";
         else if (k.includes("established")) verb = "established";
         else if (k.includes("released")) verb = "released";
         else if (k.includes("published")) verb = "published";
         else if (k.includes("created")) verb = "created";
         else if (k.includes("acquired")) verb = "acquired";
         else if (k.includes("born")) verb = "born";
         else if (k.includes("died")) verb = "died";

         if (isTime && verb !== "done") {
            clueParts.push(`${verb.toUpperCase()} IN: ${v}`);
         } else {
            clueParts.push(`${keyLabel}: ${v}`);
         }
      });
      
      const cluesStr = clueParts.join(" | ");
      return {
         type: "definition",
         prompt: `${cluesStr} — which option fits these clues?`,
         choices: seededShuffle([...new Set([label, ...seededShuffle(entitiesWithDifferentValue, rng)])].slice(0, 4), rng),
         answer: label,
      };
   }

   // ── Variant 5: Correct the error ──────────────────────
   if (variant === 5 && distractors.length >= 1) {
      const wrongValue = distractors[0];
      const otherDistractors = distractors.filter((d) => d !== wrongValue);
      if (otherDistractors.length >= 3) {
         const q = formatQuestionPrompt(5, label, chosenKey, correctValue, wrongValue);
         return {
            type: "definition",
            prompt: q.prompt,
            choices: seededShuffle([...new Set([correctValue, ...otherDistractors])].slice(0, 4), rng),
            answer: correctValue,
         };
      }
   }

   // Fallback: forward
   return {
      type: "definition",
      prompt: `What is the ${keyLabel} of ${label}?`,
      choices: seededShuffle([...new Set([correctValue, ...distractors])].slice(0, 4), rng),
      answer: correctValue,
   };
 }

 // ── Special algorithmic generators (no entities needed) ──────

 const ALGORITHMIC_CATEGORIES = new Set([
    "mental_math_blitz",
    "sequence_solver",
    "english_grammar_lab",
    "math_algebra",
    "math_geometry_puzzles"
 ]);

 function generateAlgorithmicQuestion(category: string, seed: string): any {
    const rng = createSeededRandom(hashSeed(seed));

    if (category === "mental_math_blitz") {
       const opIdx = Math.floor(rng() * 4);
       let a: number, b: number, ans: number;
       const ops = ["+", "-", "x", "/"];
       if (opIdx === 0) { a = Math.floor(rng() * 90) + 10; b = Math.floor(rng() * 90) + 10; ans = a + b; }
       else if (opIdx === 1) { a = Math.floor(rng() * 80) + 20; b = Math.floor(rng() * (a - 10)) + 10; ans = a - b; }
       else if (opIdx === 2) { a = Math.floor(rng() * 12) + 2; b = Math.floor(rng() * 12) + 2; ans = a * b; }
       else { b = Math.floor(rng() * 10) + 2; ans = Math.floor(rng() * 15) + 2; a = b * ans; }
       const correct = String(ans);
       const fakes = smartFakeAnswers(ans, rng).map(String);
       return { type: "math", prompt: `${a} ${ops[opIdx]} ${b} = ?`, choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng), answer: correct };
    }

    if (category === "sequence_solver") {
       const patternIdx = Math.floor(rng() * 6);
       let seq: number[], ans: number;
       if (patternIdx === 0) { const s = Math.floor(rng() * 10) + 1; seq = [s, s + 2, s + 4, s + 6]; ans = s + 8; }
         if (patternIdx === 0) { const s = Math.floor(rng() * 10) + 1; seq = [s, s + 2, s + 4, s + 6]; ans = s + 8; }
         else if (patternIdx === 1) { const s = Math.floor(rng() * 5) + 1; seq = [s, s * 2, s * 4, s * 8]; ans = s + 16; }
         else if (patternIdx === 2) { const s = Math.floor(rng() * 5) + 1; seq = [s, s + 3, s + 6, s + 9]; ans = s + 12; }
         else if (patternIdx === 3) { const s = Math.floor(rng() * 5) + 1; seq = Array.from({ length: 4 }, (_, i) => (s + i) ** 2); ans = (s + 4) ** 2; }
         else if (patternIdx === 4) { const s = Math.floor(rng() * 30) + 30; seq = [s, s - 5, s - 10, s - 15]; ans = s - 20; }
         else { const s = Math.floor(rng() * 5) + 1; seq = [s, s + 1, s + 3, s + 6]; ans = s + 10; }
         const correct = String(ans);
         const fakes = smartFakeAnswers(ans, rng).map(String);
         return { type: "math", prompt: `What is the next number: ${seq.join(", ")}?`, choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng), answer: correct };
      }

      if (category === "english_grammar_lab") {
         const qIdx = Math.floor(rng() * 4);
         if (qIdx === 0) {
            const sentences = [
               { s: "Every morning, my father ___ the newspaper.", c: "reads", f: ["read", "reading", "readed"] },
               { s: "Neither of the boys ___ there yesterday.", c: "was", f: ["were", "are", "been"] },
               { s: "The pack of wolves ___ through the forest.", c: "runs", f: ["run", "running", "runner"] },
               { s: "She and her sister ___ soccer on weekends.", c: "play", f: ["plays", "playing", "played"] }
            ];
            const choice = sentences[Math.floor(rng() * sentences.length)];
            const correct = choice.c;
            return {
               type: "grammar",
               prompt: `Fill in the blank: "${choice.s}"`,
               choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
               answer: correct
            };
         } else if (qIdx === 1) {
            const plurals = [
               { word: "child", c: "children", f: ["childs", "childrens", "childes"] },
               { word: "cactus", c: "cacti", f: ["cactuses", "cactus", "cactii"] },
               { word: "ox", c: "oxen", f: ["oxes", "oxs", "oxens"] },
               { word: "criterion", c: "criteria", f: ["criterions", "criterias", "criteriones"] },
               { word: "phenomenon", c: "phenomena", f: ["phenomenons", "phenomenas", "phenomenon"] }
            ];
            const choice = plurals[Math.floor(rng() * plurals.length)];
            const correct = choice.c;
            return {
               type: "grammar",
               prompt: `What is the plural of "${choice.word}"?`,
               choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
               answer: correct
            };
         } else if (qIdx === 2) {
            const spellings = [
               { c: "definitely", f: ["definately", "definitly", "definatley"] },
               { c: "necessary", f: ["neccessary", "necesary", "neccesary"] },
               { c: "receive", f: ["recieve", "receve", "recive"] },
               { c: "separate", f: ["seperate", "seperet", "separat"] },
               { c: "calendar", f: ["calender", "colendar", "calandar"] }
            ];
            const choice = spellings[Math.floor(rng() * spellings.length)];
            const correct = choice.c;
            return {
               type: "grammar",
               prompt: "Select the word that is spelled correctly:",
               choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
               answer: correct
            };
         } else {
            const tenses = [
               { s: "They had already ___ when I arrived.", c: "eaten", f: ["ate", "eat", "eating"] },
               { s: "She has ___ three miles today.", c: "run", f: ["ran", "running", "runs"] },
               { s: "The book was ___ by a famous author.", c: "written", f: ["wrote", "write", "writing"] },
               { s: "He has ___ all his water.", c: "drunk", f: ["drank", "drink", "drinking"] }
            ];
            const choice = tenses[Math.floor(rng() * tenses.length)];
            const correct = choice.c;
            return {
               type: "grammar",
               prompt: `Fill in the blank: "${choice.s}"`,
               choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
               answer: correct
            };
         }
      }

      if (category === "math_algebra") {
         const qIdx = Math.floor(rng() * 2);
         if (qIdx === 0) {
            const a = Math.floor(rng() * 8) + 2; 
            const x = Math.floor(rng() * 21) - 5; 
            const b = Math.floor(rng() * 30) - 15; 
            const c = a * x + b;
            const correct = String(x);
            const fakes = smartFakeAnswers(x, rng).map(String);
            const equationStr = `${a}x ${b >= 0 ? "+ " + b : "- " + Math.abs(b)} = ${c}`;
            return {
               type: "math",
               prompt: `Solve for x: ${equationStr}`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct
            };
         } else {
            const x = Math.floor(rng() * 12) + 2; 
            const y = Math.floor(rng() * 10) + 1; 
            const s = x + y;
            const d = x - y;
            const correct = String(x);
            const fakes = smartFakeAnswers(x, rng).map(String);
            return {
               type: "math",
               prompt: `Given x + y = ${s} and x - y = ${d}, find the value of x:`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct
            };
         }
      }

      if (category === "math_geometry_puzzles") {
         const qIdx = Math.floor(rng() * 3);
         if (qIdx === 0) {
            const b = (Math.floor(rng() * 7) + 2) * 2; 
            const h = Math.floor(rng() * 10) + 3; 
            const area = 0.5 * b * h;
            const correct = String(area);
            const fakes = smartFakeAnswers(area, rng).map(String);
            return {
               type: "math",
               prompt: `What is the area of a triangle with a base of ${b} units and a height of ${h} units?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct
            };
         } else if (qIdx === 1) {
            const w = Math.floor(rng() * 10) + 4; 
            const h = Math.floor(rng() * 10) + 4; 
            const perimeter = 2 * (w + h);
            const correct = String(perimeter);
            const fakes = smartFakeAnswers(perimeter, rng).map(String);
            return {
               type: "math",
               prompt: `What is the perimeter of a rectangle with width ${w} units and height ${h} units?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct
            };
         } else {
            const angle = Math.floor(rng() * 100) + 40; 
            const missing = 180 - angle;
            const correct = String(missing);
            const fakes = smartFakeAnswers(missing, rng).map(String);
            return {
               type: "math",
               prompt: `If two angles are supplementary (sum to 180°) and one angle is ${angle}°, what is the value of the other angle?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct
            };
         }
      }

     throw new Error(`Unknown algorithmic category: ${category}`);
  }

serve(async (req) => {
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   try {
      const { matchId, category, seed: clientSeed } = await req.json();

      if (!matchId || !category) {
         return new Response(
            JSON.stringify({ error: "matchId and category are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
         );
      }

      const seed = clientSeed || `${matchId}-${category}`;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      // Idempotency check
      const { data: existing } = await supabaseClient
         .from("wordup_matches")
         .select("questions, encryption_key")
         .eq("id", matchId)
         .single();

      if (existing?.questions && existing?.encryption_key) {
         return new Response(
            JSON.stringify({ matchId, cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
         );
      }

      // Generate 7 questions
      const questions: any[] = [];

      if (ALGORITHMIC_CATEGORIES.has(category)) {
         for (let i = 0; i < 7; i++) {
            questions.push(generateAlgorithmicQuestion(category, `${seed}-${i}`));
         }
      } else {
         // Entity-based: fetch rows from wordup_entities
         const { data: entities, error: entityError } = await supabaseClient
            .from("wordup_entities")
            .select("*")
            .eq("type", category)
            .limit(100);

         if (entityError) {
            console.warn("[generate-match-questions] Entity fetch error:", entityError);
         }

         const entityList: any[] = entities || [];

         if (entityList.length === 0) {
            // No entities found → fallback to algorithmic
            for (let i = 0; i < 7; i++) {
               questions.push(generateAlgorithmicQuestion("mental_math_blitz", `${seed}-${i}`));
            }
         } else {
            const matchRng = createSeededRandom(hashSeed(seed));
            const baseVariants = [0, 0, 1, 1, 2, 3, 4, 5];
            const shuffledVariants = seededShuffle(baseVariants, matchRng);
            const variantSequence = shuffledVariants.slice(0, 7);

            const shuffledEntities = seededShuffle(entityList, matchRng);
            const easy = shuffledEntities.filter((e) => (e.difficulty ?? 3) <= 2);
            const medium = shuffledEntities.filter((e) => (e.difficulty ?? 3) === 3);
            const hard = shuffledEntities.filter((e) => (e.difficulty ?? 3) >= 4);

            const chosenEntities: any[] = [];
            const usedIds = new Set<string>();

            const getNextEntity = (preferredPool: any[], fallbackPools: any[][]): any => {
               for (const e of preferredPool) {
                  if (!usedIds.has(e.id)) {
                     usedIds.add(e.id);
                     return e;
                  }
               }
               for (const pool of fallbackPools) {
                  for (const e of pool) {
                     if (!usedIds.has(e.id)) {
                        usedIds.add(e.id);
                        return e;
                     }
                  }
               }
               if (shuffledEntities.length > 0) {
                  const idx = chosenEntities.length % shuffledEntities.length;
                  return shuffledEntities[idx];
               }
               return null;
            };

            for (let i = 0; i < 7; i++) {
               let entity: any = null;
               if (i < 2) {
                  entity = getNextEntity(easy, [medium, hard]);
               } else if (i < 5) {
                  entity = getNextEntity(medium, [hard, easy]);
               } else {
                  entity = getNextEntity(hard, [medium, easy]);
               }
               chosenEntities.push(entity);

               const variant = variantSequence[i] ?? 0;
               questions.push(generateQuestion(`${seed}-${i}`, entity, entityList, variant));
            }
         }
      }

      // Encrypt and persist
      const plaintext = JSON.stringify(questions);
      const encryptionKey = await generateSecureSessionKey();
      const encryptedQuestions = await encryptPayload(plaintext, encryptionKey);

      const { error: updateError } = await supabaseClient
         .from("wordup_matches")
         .update({
            questions: encryptedQuestions,
            encryption_key: encryptionKey,
         })
         .eq("id", matchId);

      if (updateError) {
         console.error("[generate-match-questions] DB update error:", updateError);
         const { error: payloadError } = await supabaseClient
            .from("wordup_match_payloads")
            .insert({ match_id: matchId, encrypted_payload: encryptedQuestions });
         if (payloadError) {
            throw new Error(`Failed to store payload: ${payloadError.message}`);
         }
      }

      return new Response(
         JSON.stringify({ matchId, encryptedQuestions, encryptionKey, questionCount: questions.length }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
   } catch (err: any) {
      console.error("[generate-match-questions] Error:", err);
      return new Response(
         JSON.stringify({ error: err.message || "Internal error" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
   }
});
