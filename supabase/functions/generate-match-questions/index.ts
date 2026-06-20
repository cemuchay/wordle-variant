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

function generateQuestion(seed: string, entity: any, allEntities: any[]): any {
   const qObj = _generateQuestion(seed, entity, allEntities);
   const meta = entity?.metadata || {};
   if (meta.image) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      qObj.imageUrl = `${supabaseUrl}/storage/v1/object/public/wordup-questions/${meta.image}`;
   }
   return qObj;
}

function _generateQuestion(seed: string, entity: any, allEntities: any[]): any {
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
      const choices = seededShuffle([label, ...distractors], rng);
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
      distractors = getNumericDistractors(correctValue, rng).slice(0, 3);
   }

   // If not numeric, or we couldn't generate at least 3 numeric distractors, get from peers
   if (distractors.length < 3) {
      const otherValues = validDistractorPool
         .map((e) => String(e.metadata?.[chosenKey] ?? ""))
         .filter((v) => v && v !== correctValue);
      const uniqueOtherValues = [...new Set(otherValues)];
      
      const peerDistractors = seededShuffle(uniqueOtherValues, rng);
      for (const dist of peerDistractors) {
         if (!distractors.includes(dist)) {
            distractors.push(dist);
         }
         if (distractors.length >= 3) break;
      }

      // If still not enough, pad with otherValues (including non-unique) or general fallback
      if (distractors.length < 3) {
         const nonUniquePeers = seededShuffle(otherValues, rng);
         for (const dist of nonUniquePeers) {
            if (!distractors.includes(dist)) {
               distractors.push(dist);
            }
            if (distractors.length >= 3) break;
         }
      }

      // Final fallback padding
      while (distractors.length < 3) {
         distractors.push(`Alternative ${label} Metric`);
      }
   }

   const entitiesWithDifferentValue = validDistractorPool
      .filter((e) => String(e.metadata?.[chosenKey] ?? "") !== correctValue)
      .map((e) => e.label)
      .filter((l) => l);

   const metaKeys = Object.keys(meta).filter((k) => !SKIP_KEYS.has(k));
   const variant = Math.floor(rng() * 6); // 0-5

   // ── Variant 0: Forward ──────────────────────────────────
   if (variant === 0 || distractors.length < 1) {
      return {
         type: "definition",
         prompt: `What is the ${keyLabel} of ${label}?`,
         choices: seededShuffle([correctValue, ...distractors.slice(0, 3)], rng),
         answer: correctValue,
      };
   }

   // ── Variant 1: Reverse ──────────────────────────────────
   if (variant === 1 && entitiesWithDifferentValue.length >= 3) {
      return {
         type: "definition",
         prompt: `"${correctValue}" is the ${keyLabel} of which option?`,
         choices: seededShuffle([label, ...seededShuffle(entitiesWithDifferentValue, rng).slice(0, 3)], rng),
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
         .filter(([, info]) => info.count >= 3 && info.labels.length >= 3)
         .sort(() => rng() - 0.5);
      if (shared.length > 0) {
         const [sharedValue, info] = shared[0];
         return {
            type: "definition",
            prompt: `Which ${keyLabel} is different from the others?`,
            choices: seededShuffle([...seededShuffle(info.labels, rng).slice(0, 3), label], rng),
            answer: label,
            subPrompt: `The others have ${keyLabel} "${sharedValue}".`,
         };
      }
   }

   // ── Variant 3: True/False ─────────────────────────────
   if (variant === 3 && distractors.length >= 1) {
      const isTrue = Math.floor(rng() * 2) === 0;
      const displayedValue = isTrue ? correctValue : distractors[0];
      return {
         type: "definition",
         prompt: `True or false: ${label} has ${keyLabel} "${displayedValue}".`,
         choices: ["True", "False"],
         answer: isTrue ? "True" : "False",
      };
   }

   // ── Variant 4: Multi-clue (What am I?) ────────────────
   if (variant === 4 && metaKeys.length >= 2 && entitiesWithDifferentValue.length >= 3) {
      const clueKeys = seededShuffle(metaKeys, rng).slice(0, Math.min(3, metaKeys.length));
      const clues = clueKeys.map((k: string) => {
         const v = String(meta[k] ?? "");
         return `${k.replace(/_/g, " ")}: ${v}`;
      }).join(" | ");
      return {
         type: "definition",
         prompt: `${clues} — what does this describe?`,
         choices: seededShuffle([label, ...seededShuffle(entitiesWithDifferentValue, rng).slice(0, 3)], rng),
         answer: label,
      };
   }

   // ── Variant 5: Correct the error ──────────────────────
   if (variant === 5 && distractors.length >= 3) {
      const wrongValue = distractors[0];
      return {
         type: "definition",
         prompt: `Fix the error: ${label} has ${keyLabel} "${wrongValue}". What is the correct ${keyLabel}?`,
         choices: seededShuffle([correctValue, ...distractors.slice(0, 3)], rng),
         answer: correctValue,
      };
   }

   // Fallback: forward
   return {
      type: "definition",
      prompt: `What is the ${keyLabel} of ${label}?`,
      choices: seededShuffle([correctValue, ...distractors.slice(0, 3)], rng),
      answer: correctValue,
   };
 }

 // ── Special algorithmic generators (no entities needed) ──────

 const ALGORITHMIC_CATEGORIES = new Set(["mental_math_blitz", "sequence_solver"]);

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
       return { type: "math", prompt: `${a} ${ops[opIdx]} ${b} = ?`, choices: seededShuffle([correct, ...fakes].slice(0, 4), rng), answer: correct };
    }

    if (category === "sequence_solver") {
       const patternIdx = Math.floor(rng() * 6);
       let seq: number[], ans: number;
       if (patternIdx === 0) { const s = Math.floor(rng() * 10) + 1; seq = [s, s + 2, s + 4, s + 6]; ans = s + 8; }
       else if (patternIdx === 1) { const s = Math.floor(rng() * 5) + 1; seq = [s, s * 2, s * 4, s * 8]; ans = s * 16; }
       else if (patternIdx === 2) { const s = Math.floor(rng() * 5) + 1; seq = [s, s + 3, s + 6, s + 9]; ans = s + 12; }
       else if (patternIdx === 3) { const s = Math.floor(rng() * 5) + 1; seq = Array.from({ length: 4 }, (_, i) => (s + i) ** 2); ans = (s + 4) ** 2; }
       else if (patternIdx === 4) { const s = Math.floor(rng() * 30) + 30; seq = [s, s - 5, s - 10, s - 15]; ans = s - 20; }
       else { const s = Math.floor(rng() * 5) + 1; seq = [s, s + 1, s + 3, s + 6]; ans = s + 10; }
       const correct = String(ans);
       const fakes = smartFakeAnswers(ans, rng).map(String);
       return { type: "math", prompt: `What is the next number: ${seq.join(", ")}?`, choices: seededShuffle([correct, ...fakes].slice(0, 4), rng), answer: correct };
    }

    throw new Error(`Unknown algorithmic category: ${category}`);
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
            .limit(14);

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
            for (let i = 0; i < 7; i++) {
               const entity = entityList[i % entityList.length];
               questions.push(generateQuestion(`${seed}-${i}`, entity, entityList));
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
            status: "countdown",
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
