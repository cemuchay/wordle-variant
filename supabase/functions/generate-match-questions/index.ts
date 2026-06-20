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

const SKIP_KEYS = new Set(["_distractors", "_symbolDistractors", "_directorDistractors", "id"]);

// Score metadata keys by how many unique values they have across entities.
// Higher score = more distinctive = better for questions.
function scoreKeys(allEntities: any[]): Map<string, { key: string; uniqueCount: number; totalCount: number }> {
   const keyValues = new Map<string, Set<string>>();
   const keyTotal = new Map<string, number>();

   for (const e of allEntities) {
      if (!e?.metadata) continue;
      for (const k of Object.keys(e.metadata)) {
         if (SKIP_KEYS.has(k)) continue;
         const v = String(e.metadata[k] ?? "");
         if (!v) continue;
         if (!keyValues.has(k)) keyValues.set(k, new Set());
         keyValues.get(k)!.add(v);
         keyTotal.set(k, (keyTotal.get(k) || 0) + 1);
      }
   }

   const result = new Map<string, { key: string; uniqueCount: number; totalCount: number }>();
   for (const [key, values] of keyValues) {
      result.set(key, { key, uniqueCount: values.size, totalCount: keyTotal.get(key) || 0 });
   }
   return result;
}

// Pick the best key: prefer keys where unique count = total count (every entity has a unique value)
function pickBestKey(scores: Map<string, { key: string; uniqueCount: number; totalCount: number }>, rng: () => number): string | null {
   const candidates = Array.from(scores.values());
   if (candidates.length === 0) return null;

   // Sort: most unique first (unique/total ratio), break ties by total count
   candidates.sort((a, b) => {
      const ratioA = a.uniqueCount / a.totalCount;
      const ratioB = b.uniqueCount / b.totalCount;
      if (ratioB !== ratioA) return ratioB - ratioA;
      return b.totalCount - a.totalCount;
   });

   // Pick from top half to add variety
   const topN = Math.max(1, Math.ceil(candidates.length / 2));
   return candidates[Math.floor(rng() * topN)].key;
}

function generateQuestion(seed: string, entity: any, allEntities: any[]): any {
   const rng = createSeededRandom(hashSeed(seed));
   const label = entity?.label || "Unknown";
   const meta = entity?.metadata || {};

   if (!entity || allEntities.length < 2) {
      return {
         type: "definition",
         prompt: `Identify: ${label}`,
         choices: [label, "Unknown", "None", "All"],
         answer: label,
      };
   }

   // Score keys and pick the best one
   const scores = scoreKeys(allEntities);
   const key = pickBestKey(scores, rng);

   if (!key) {
      // Fallback: pure label matching
      const distractors = seededShuffle(
         allEntities.filter((e) => e.label !== label).map((e) => e.label),
         rng,
      ).slice(0, 3);
      const choices = seededShuffle([label, ...distractors], rng);
      return { type: "definition", prompt: `Which of the following is "${label}"?`, choices, answer: label };
   }

   const correctValue = String(meta[key] ?? "");

   // Find entities with a DIFFERENT value for this key (for forward question distractors)
   const otherValues = allEntities
      .filter((e) => e.id !== entity?.id)
      .map((e) => String(e.metadata?.[key] ?? ""))
      .filter((v) => v && v !== correctValue);
   const uniqueOtherValues = [...new Set(otherValues)].sort(() => rng() - 0.5).slice(0, 3);

   // Find entities whose value for this key DIFFERS from the correct entity's value (for reverse distractors)
   const entitiesWithDifferentValue = allEntities
      .filter((e) => e.id !== entity?.id && String(e.metadata?.[key] ?? "") !== correctValue)
      .map((e) => e.label)
      .filter((l) => l);

   const useReverse = Math.floor(rng() * 2) === 0;

   if (useReverse && entitiesWithDifferentValue.length >= 3) {
      // Reverse: "[value]" is the [key] of which option?
      // All distractor labels must have a DIFFERENT [key] value
      const choices = seededShuffle([label, ...seededShuffle(entitiesWithDifferentValue, rng).slice(0, 3)], rng);
      return {
         type: "definition",
         prompt: `"${correctValue}" is the ${key.replace(/_/g, " ")} of which option?`,
         choices,
         answer: label,
      };
   }

   // Forward: what is the [key] of [label]?
   const distractors = uniqueOtherValues.length >= 3
      ? uniqueOtherValues
      : otherValues.concat(["Unknown", "None", "All"]).sort(() => rng() - 0.5).slice(0, 3);

   const choices = seededShuffle([correctValue, ...distractors], rng);
   return {
      type: "definition",
      prompt: `What is the ${key.replace(/_/g, " ")} of ${label}?`,
      choices,
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
