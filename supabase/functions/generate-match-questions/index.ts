import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

import { ALGORITHMIC_CATEGORIES, CATEGORY_SUPER_MAP } from "./types.ts";
import { createSeededRandom, seededShuffle, hashSeed, isNumeric, getNumericDistractors } from "./utils.ts";
import { formatQuestionPrompt } from "./promptFormatter.ts";
import { generateMathsQuestion } from "./maths.ts";
import { generateEnglishQuestion } from "./english.ts";

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

// ── Generic entity-based question generator ──────────────────

const SKIP_KEYS = new Set(["_distractors", "_symbolDistractors", "_directorDistractors", "id", "image"]);

function generateQuestion(seed: string, entity: any, allEntities: any[], variantOverride?: number, category?: string): any {
   const qObj = _generateQuestion(seed, entity, allEntities, variantOverride, category);
   const meta = entity?.metadata || {};
   if (meta.image) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      qObj.imageUrl = `${supabaseUrl}/storage/v1/object/public/wordup-questions/${meta.image}`;
   }
   return qObj;
}

function _generateQuestion(seed: string, entity: any, allEntities: any[], variantOverride?: number, category?: string): any {
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
      const q = formatQuestionPrompt(0, label, chosenKey, correctValue, "", categoryType);
      return {
         type: "definition",
         prompt: q.prompt,
         choices: seededShuffle([...new Set([correctValue, ...distractors])].slice(0, 4), rng),
         answer: correctValue,
      };
   }

   // ── Variant 1: Reverse ──────────────────────────────────
   if (variant === 1 && entitiesWithDifferentValue.length >= 3) {
      const q = formatQuestionPrompt(1, label, chosenKey, correctValue, "", categoryType);
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
      const q = formatQuestionPrompt(3, label, chosenKey, correctValue, displayedValue, categoryType);
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
         const capitalizedLabel = keyLabel.charAt(0).toUpperCase() + keyLabel.slice(1);
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
            clueParts.push(`${capitalizedLabel}: ${v}`);
         }
      });
      
      const cluesStr = clueParts.map((p) => `• ${p}`).join("\n");
      const isWordMatch = categoryType.includes("english") || categoryType.includes("language") || categoryType.includes("vocab");
      const intro = isWordMatch 
         ? "Find the word that fits these clues:" 
         : "Identify the match that fits these clues:";

      return {
         type: "definition",
         prompt: `${intro}\n${cluesStr}`,
         choices: seededShuffle([...new Set([label, ...seededShuffle(entitiesWithDifferentValue, rng)])].slice(0, 4), rng),
         answer: label,
      };
   }

   // ── Variant 5: Correct the error ──────────────────────
   if (variant === 5 && distractors.length >= 1) {
      const wrongValue = distractors[0];
      const otherDistractors = distractors.filter((d) => d !== wrongValue);
      if (otherDistractors.length >= 3) {
         const q = formatQuestionPrompt(5, label, chosenKey, correctValue, wrongValue, categoryType);
         return {
            type: "definition",
            prompt: q.prompt,
            choices: seededShuffle([...new Set([correctValue, ...otherDistractors])].slice(0, 4), rng),
            answer: correctValue,
         };
      }
   }

   // Fallback: forward
   const fallbackQ = formatQuestionPrompt(0, label, chosenKey, correctValue, "", categoryType);
   return {
      type: "definition",
      prompt: fallbackQ.prompt,
      choices: seededShuffle([...new Set([correctValue, ...distractors])].slice(0, 4), rng),
      answer: correctValue,
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

      // Query database entities if it's a procedural database category
      // Unified 'maths' and 'english_language' topics will query their corresponding DB facts
      let dbCategoryQuery = category;
      if (category === "maths") {
         // Query 'math_fundamentals' facts for hybrid math trivia
         dbCategoryQuery = "math_fundamentals";
      } else if (category === "english_language") {
         // Query 'english_vocabulary', 'english_idioms', and 'english_fundamentals' facts
         dbCategoryQuery = "english_vocabulary,english_idioms,english_fundamentals";
      }

      const typeFilter = dbCategoryQuery.includes(",")
         ? { typeFilter: "in", types: dbCategoryQuery.split(",") }
         : { typeFilter: "eq", types: [dbCategoryQuery] };

      let queryBuilder = supabaseClient
         .from("wordup_entities")
         .select("*");

      if (typeFilter.typeFilter === "in") {
         queryBuilder = queryBuilder.in("type", typeFilter.types);
      } else {
         queryBuilder = queryBuilder.eq("type", dbCategoryQuery);
      }

      const { data: entities, error: entityError } = await queryBuilder
         .limit(100);

      if (entityError) {
         console.warn("[generate-match-questions] Entity fetch error:", entityError);
      }

      const entityList: any[] = entities || [];
      const matchRng = createSeededRandom(hashSeed(seed));

      // 6 variants (0-5), 7 rounds → each variant at least once, 7th is random
      const baseVariants = [0, 1, 2, 3, 4, 5];
      const shuffledVariants = seededShuffle(baseVariants, matchRng);
      const extraVariant = Math.floor(matchRng() * 6);
      const variantSequence = [...shuffledVariants, extraVariant];

      // Prepare progression pools
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
         const roundSeed = `${seed}-${i}`;
         const roundRng = createSeededRandom(hashSeed(roundSeed));
         const variant = variantSequence[i] ?? 0;

         // Route by category: hybrid algorithmic logic takes precedence
         if (category === "maths") {
            let entity = null;
            if (entityList.length > 0) {
               if (i < 2) entity = getNextEntity(easy, [medium, hard]);
               else if (i < 5) entity = getNextEntity(medium, [hard, easy]);
               else entity = getNextEntity(hard, [medium, easy]);
               chosenEntities.push(entity);
            }
            const q = generateMathsQuestion(roundSeed, entity, entityList, roundRng, variant);
            if (q) {
               questions.push(q);
               continue;
            }
            // Fallback to standard entity question
            if (entity) {
               questions.push(generateQuestion(roundSeed, entity, entityList, variant, category));
               continue;
            }
         }

         if (category === "english_language") {
            let entity = null;
            if (entityList.length > 0) {
               if (i < 2) entity = getNextEntity(easy, [medium, hard]);
               else if (i < 5) entity = getNextEntity(medium, [hard, easy]);
               else entity = getNextEntity(hard, [medium, easy]);
               chosenEntities.push(entity);
            }
            const q = generateEnglishQuestion(roundSeed, entity, entityList, roundRng, variant);
            if (q) {
               questions.push(q);
               continue;
            }
            // Fallback to standard entity question
            if (entity) {
               questions.push(generateQuestion(roundSeed, entity, entityList, variant, category));
               continue;
            }
         }

         // Standard entity-based procedural category logic
         if (entityList.length === 0) {
            // No entities found → fallback to math calculations
            const q = generateMathsQuestion(roundSeed, null, [], roundRng, variant);
            questions.push(q);
         } else {
            let entity = null;
            if (i < 2) {
               entity = getNextEntity(easy, [medium, hard]);
            } else if (i < 5) {
               entity = getNextEntity(medium, [hard, easy]);
            } else {
               entity = getNextEntity(hard, [medium, easy]);
            }
            chosenEntities.push(entity);
            questions.push(generateQuestion(roundSeed, entity, entityList, variant, category));
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
