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

function generateQuestion(seed: string, entity: any, allEntities: any[]): any {
   const rng = createSeededRandom(hashSeed(seed));
   const label = entity?.label || "Unknown";
   const meta = entity?.metadata || {};
   const metaKeys = Object.keys(meta).filter((k) => !SKIP_KEYS.has(k));

   if (metaKeys.length === 0) {
      // Fallback: pure label-based question using other entities as distractors
      const distractors = seededShuffle(
         allEntities.filter((e) => e.label !== label).map((e) => e.label),
         rng,
      ).slice(0, 3);
      const options = seededShuffle([label, ...distractors], rng);
      return {
         id: seed,
         question: `Which of the following is "${label}"?`,
         options,
         answer: label,
         metadata: { generatorId: "generic", entityId: entity?.id },
      };
   }

   // Pick a random metadata key to ask about
   const key = metaKeys[Math.floor(rng() * metaKeys.length)];
   const correctValue = String(meta[key] ?? "");

   // Collect other entities' values for the same key (as distractors)
   const allValues = allEntities
      .filter((e) => e.id !== entity?.id)
      .map((e) => String(e.metadata?.[key] ?? ""))
      .filter((v) => v && v !== correctValue);

   const uniqueDistractors = [...new Set(allValues)].sort(() => rng() - 0.5).slice(0, 3);

   const useReverse = Math.floor(rng() * 2) === 0;

   if (useReverse && uniqueDistractors.length >= 3) {
      // Reverse question: [value] is the [key] of which [label]?
      const options = seededShuffle([label, ...allEntities
         .filter((e) => e.label !== label)
         .map((e) => e.label)
         .filter((l) => l)
         .sort(() => rng() - 0.5)
         .slice(0, 3)], rng);
      return {
         id: seed,
         question: `"${correctValue}" is the ${key.replace(/_/g, " ")} of which option?`,
         options,
         answer: label,
         explanation: `${label} has ${key.replace(/_/g, " ")} "${correctValue}".`,
         metadata: { generatorId: "generic", entityId: entity?.id },
      };
   }

   // Forward question: what is the [key] of [label]?
   const distractors = uniqueDistractors.length >= 3
      ? uniqueDistractors
      : allEntities
         .filter((e) => e.id !== entity?.id)
         .map((e) => String(e.metadata?.[key] ?? ""))
         .filter((v) => v && v !== correctValue)
         .concat(["Unknown", "None", "All"])
         .sort(() => rng() - 0.5)
         .slice(0, 3);

   const options = seededShuffle([correctValue, ...distractors], rng);
   return {
      id: seed,
      question: `What is the ${key.replace(/_/g, " ")} of ${label}?`,
      options,
      answer: correctValue,
      explanation: `${label} has ${key.replace(/_/g, " ")} "${correctValue}".`,
      metadata: { generatorId: "generic", entityId: entity?.id },
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
      return { id: seed, question: `${a} ${ops[opIdx]} ${b} = ?`, options: seededShuffle([correct, ...fakes].slice(0, 4), rng), answer: correct, metadata: { generatorId: "mental_math_blitz" } };
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
      return { id: seed, question: `What is the next number: ${seq.join(", ")}?`, options: seededShuffle([correct, ...fakes].slice(0, 4), rng), answer: correct, metadata: { generatorId: "sequence_solver" } };
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
         .select("encrypted_questions, encryption_key")
         .eq("id", matchId)
         .single();

      if (existing?.encrypted_questions && existing?.encryption_key) {
         return new Response(
            JSON.stringify({ matchId, encryptedQuestions: existing.encrypted_questions, encryptionKey: existing.encryption_key, cached: true }),
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
            encrypted_questions: encryptedQuestions,
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
