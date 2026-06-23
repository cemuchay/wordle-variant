import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

import { CATEGORY_SUPER_MAP } from "./types.ts";
import { getQuestionConfig } from "./questionConfig.ts";
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
const DEFAULT_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1];

function pickVariants(weights: number[], rng: () => number, count: number): number[] {
   const total = weights.reduce((a, b) => a + b, 0);
   return Array.from({ length: count }, () => {
      let roll = rng() * total;
      for (let v = 0; v < weights.length; v++) {
         roll -= weights[v];
         if (roll <= 0) return v;
      }
      return weights.length - 1;
   });
}

function buildVariantTryOrder(assignedVariant: number, weights: number[]): number[] {
   const others = weights
      .map((w, i) => ({ variant: i, weight: w }))
      .filter((item) => item.variant !== assignedVariant)
      .sort((a, b) => b.weight - a.weight);
   return [assignedVariant, ...others.map((o) => o.variant)];
}

function generateQuestion(seed: string, entity: any, allEntities: any[], variantOverride?: number, category?: string, variantWeights?: number[]): any {
   const qObj = _generateQuestion(seed, entity, allEntities, variantOverride, category, variantWeights);
   const meta = entity?.metadata || {};
   if (meta.image) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      qObj.imageUrl = `${supabaseUrl}/storage/v1/object/public/wordup-questions/${meta.image}`;
   }
   return qObj;
}

function _generateQuestion(seed: string, entity: any, allEntities: any[], variantOverride?: number, category?: string, variantWeights?: number[]): any {
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
   const weights = variantWeights ?? DEFAULT_WEIGHTS;
   const assignedVariant = variantOverride !== undefined ? variantOverride : Math.floor(rng() * weights.length);
   const tryOrder = buildVariantTryOrder(assignedVariant, weights);

   for (const v of tryOrder) {
      let q: any = null;

      // ── Variant 0: Forward ──────────────────────────────────
      if (v === 0 || distractors.length < 1) {
         const prompt = formatQuestionPrompt(0, label, chosenKey, correctValue, "", categoryType);
         q = {
            type: "definition",
            prompt: prompt.prompt,
            choices: seededShuffle([...new Set([correctValue, ...distractors])].slice(0, 4), rng),
            answer: correctValue,
         };
         return q;
      }

      // ── Variant 1: Reverse ──────────────────────────────────
      if (v === 1 && entitiesWithDifferentValue.length >= 3) {
         const prompt = formatQuestionPrompt(1, label, chosenKey, correctValue, "", categoryType);
         q = {
            type: "definition",
            prompt: prompt.prompt,
            choices: seededShuffle([...new Set([label, ...seededShuffle(entitiesWithDifferentValue, rng)])].slice(0, 4), rng),
            answer: label,
         };
         return q;
      }

      // ── Variant 2: Odd one out ─────────────────────────────
      if (v === 2 && distractors.length >= 1) {
         const valueCounts = new Map<string, { count: number; labels: string[] }>();
         for (const e of allEntities) {
            if (e.id === entity?.id) continue;
            const val = String(e.metadata?.[chosenKey] ?? "");
            if (!val) continue;
            if (!valueCounts.has(val)) valueCounts.set(val, { count: 0, labels: [] });
            const entry = valueCounts.get(val)!;
            entry.count++;
            entry.labels.push(e.label);
         }
         const shared = Array.from(valueCounts.entries())
            .filter(([val, info]) => val !== correctValue && info.count >= 3 && info.labels.length >= 3)
            .sort(() => rng() - 0.5);
         if (shared.length > 0) {
            const [sharedValue, info] = shared[0];
            q = {
               type: "definition",
               prompt: `Which of these options does not share the same ${keyLabel} as the others?`,
               choices: seededShuffle([...new Set([...seededShuffle(info.labels, rng).slice(0, 3), label])].slice(0, 4), rng),
               answer: label,
               subPrompt: `The others have the ${keyLabel} "${sharedValue}".`,
            };
            return q;
         }
      }

      // ── Variant 3: True/False ─────────────────────────────
      if (v === 3 && distractors.length >= 1) {
         const isTrue = Math.floor(rng() * 2) === 0;
         const displayedValue = isTrue ? correctValue : distractors[0];
         const prompt = formatQuestionPrompt(3, label, chosenKey, correctValue, displayedValue, categoryType);
         q = {
            type: "definition",
            prompt: prompt.prompt,
            choices: ["True", "False"],
            answer: isTrue ? "True" : "False",
         };
         return q;
      }

      // ── Variant 4: Multi-clue (What am I?) ────────────────
      if (v === 4 && metaKeys.length >= 2 && entitiesWithDifferentValue.length >= 3) {
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
            const kLabel = key.replace(/_/g, " ").trim();
            const capitalizedLabel = kLabel.charAt(0).toUpperCase() + kLabel.slice(1);
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

         q = {
            type: "definition",
            prompt: `${intro}\n${cluesStr}`,
            choices: seededShuffle([...new Set([label, ...seededShuffle(entitiesWithDifferentValue, rng)])].slice(0, 4), rng),
            answer: label,
         };
         return q;
      }

      // ── Variant 5: Correct the error ──────────────────────
      if (v === 5 && distractors.length >= 1) {
         const wrongValue = distractors[0];
         const otherDistractors = distractors.filter((d) => d !== wrongValue);
         if (otherDistractors.length >= 3) {
            const prompt = formatQuestionPrompt(5, label, chosenKey, correctValue, wrongValue, categoryType);
            q = {
               type: "definition",
               prompt: prompt.prompt,
               choices: seededShuffle([...new Set([correctValue, ...otherDistractors])].slice(0, 4), rng),
               answer: correctValue,
            };
            return q;
         }
      }

      // ── Variant 6: Tag Match ─────────────────────────────
      if (v === 6 && entity.tags?.length > 0) {
         const allTags = [...new Set(allEntities.flatMap((e: any) => e.tags || []))];
         const myTags: string[] = entity.tags;
         const otherTags = allTags.filter((t: string) => !myTags.includes(t));
         if (otherTags.length >= 3) {
            const tagCounts = new Map<string, number>();
            for (const e of allEntities) {
               for (const t of (e.tags || [])) {
                  tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
               }
            }
            const sortedTags = seededShuffle([...myTags], rng)
               .sort((a, b) => (tagCounts.get(a) || 0) - (tagCounts.get(b) || 0));
            const chosenTag = sortedTags[0];
            const tagDistractors = seededShuffle(otherTags, rng).slice(0, 3);
            q = {
               type: "definition",
               prompt: `Which category best fits "${label}"?`,
               choices: seededShuffle([chosenTag, ...tagDistractors], rng),
               answer: chosenTag,
            };
            return q;
         }
      }

      // ── Variant 7: Compare (Numeric) ─────────────────────
      if (v === 7 && isNum) {
         const validPeers = allEntities.filter(
            (e: any) => e.id !== entity.id && e.metadata?.[chosenKey] !== undefined &&
               isNumeric(String(e.metadata[chosenKey]))
         );
         if (validPeers.length >= 1) {
            const peer = seededShuffle(validPeers, rng)[0];
            const sanitize = (val: string) => val.replace(/[$,%\s]/g, "").replace(/,/g, "");
            const peerNum = parseFloat(sanitize(String(peer.metadata[chosenKey])));
            const correctNum = parseFloat(sanitize(correctValue));
            if (!isNaN(correctNum) && !isNaN(peerNum) && correctNum !== peerNum) {
               const isHigher = rng() > 0.5;
               const winner = isHigher
                  ? (correctNum > peerNum ? label : peer.label)
                  : (correctNum < peerNum ? label : peer.label);
               q = {
                  type: "definition",
                  prompt: isHigher
                     ? `Which has a higher ${keyLabel}: "${label}" or "${peer.label}"?`
                     : `Which has a lower ${keyLabel}: "${label}" or "${peer.label}"?`,
                  choices: seededShuffle([label, peer.label], rng),
                  answer: winner,
               };
               return q;
            }
         }
      }

      // ── Variant 8: Timeline ──────────────────────────────
      if (v === 8 && isNum) {
         const k = chosenKey.toLowerCase();
         const isTime = k.includes("year") || k.includes("date") || k.includes("founded") ||
            k.includes("released") || k.includes("created") || k.includes("acquired");
         if (isTime) {
            const sanitize = (val: string) => val.replace(/[$,%\s]/g, "").replace(/,/g, "");
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
               const answer = askEarliest ? candidates[0] : candidates[candidates.length - 1];
               const timelineDistractors = seededShuffle(
                  candidates.filter((c) => c.label !== answer.label), rng
               ).slice(0, 3).map((c) => c.label);
               q = {
                  type: "definition",
                  prompt: askEarliest
                     ? `Which of these happened earliest (${keyLabel})?`
                     : `Which of these happened most recently (${keyLabel})?`,
                  choices: seededShuffle([answer.label, ...timelineDistractors], rng),
                  answer: answer.label,
               };
               return q;
            }
         }
      }
   }
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
      const logPrefix = `[generate-match-questions]`;

      console.log(`${logPrefix} Starting for match=${matchId} category=${category} seed=${seed}`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      // Idempotency check
      console.log(`${logPrefix} Checking existing match ${matchId}`);
      const { data: existing } = await supabaseClient
         .from("wordup_matches")
         .select("questions, encryption_key, player1_id, player2_id, is_bot_match")
         .eq("id", matchId)
         .single();

      if (existing?.questions && existing?.encryption_key) {
         return new Response(
            JSON.stringify({ matchId, cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
         );
      }

      // Gather player IDs to exclude/deprioritize seen entities
      const playerIds: string[] = [];
      if (existing?.player1_id) playerIds.push(existing.player1_id);
      if (existing?.player2_id && !existing.is_bot_match) {
         playerIds.push(existing.player2_id);
      }

      // Call the RPC function to get randomized entities with even type distribution and user history filter
      const { data: entities, error: entityError } = await supabaseClient
         .rpc("get_wordup_entities_v2", {
            p_category: category,
            p_user_ids: playerIds,
            p_limit_per_type: 40
         });

      if (entityError) {
         console.warn("[generate-match-questions] RPC get_wordup_entities_v2 error:", entityError);
      }

      const entityList: any[] = entities || [];
      console.log(`${logPrefix} Fetched ${entityList.length} entities for category="${category}"`);
      if (entityList.length > 0) {
         console.log(`${logPrefix} Entity sample:`, JSON.stringify(entityList.slice(0, 2)).substring(0, 300));
      } else {
         console.warn(`${logPrefix} No entities returned from RPC — will fallback to procedural questions`);
      }

      const matchRng = createSeededRandom(hashSeed(seed));
      const config = getQuestionConfig(category);

      // Weighted variant selection from config
      const variantSequence = pickVariants(config.variantWeights, matchRng, 7);

      // Random difficulty — single shuffled pool, no progression
      const shuffledEntities = seededShuffle(entityList, matchRng);
      let entityCursor = 0;

      const chosenEntities: any[] = [];
      const usedIds = new Set<string>();
      const questions: any[] = [];

      const getNextEntity = (): any => {
         if (shuffledEntities.length === 0) return null;
         const attempts = shuffledEntities.length * 2;
         for (let attempt = 0; attempt < attempts; attempt++) {
            const e = shuffledEntities[entityCursor % shuffledEntities.length];
            entityCursor++;
            if (!usedIds.has(e.id)) {
               usedIds.add(e.id);
               return e;
            }
         }
         // if all used, cycle anyway
         const e = shuffledEntities[entityCursor % shuffledEntities.length];
         entityCursor++;
         return e;
      };

      console.log(`${logPrefix} Variant sequence: [${variantSequence.join(", ")}]`);
      console.log(`${logPrefix} Config: proceduralWeight=${config.proceduralWeight} variantWeights=[${config.variantWeights.join(", ")}]`);

      for (let i = 0; i < 7; i++) {
         const roundSeed = `${seed}-${i}`;
         const roundRng = createSeededRandom(hashSeed(roundSeed));
         const variant = variantSequence[i] ?? 0;

         console.log(`${logPrefix} Round ${i}: variant=${variant} category=${category}`);

         // Route by category: hybrid algorithmic logic takes precedence
         if (category === "maths") {
            const entity = entityList.length > 0 ? getNextEntity() : null;
            chosenEntities.push(entity);
            console.log(`${logPrefix} Round ${i} [maths]: entity=${entity?.label ?? "null"}`);
            const q = generateMathsQuestion(roundSeed, entity, entityList, roundRng, variant, config.proceduralWeight);
            if (q) {
               console.log(`${logPrefix} Round ${i} [maths]: generated procedural question type=${q.type}`);
               questions.push(q);
               continue;
            }
            if (entity) {
               console.log(`${logPrefix} Round ${i} [maths]: falling back to entity question for ${entity.label}`);
               questions.push(generateQuestion(roundSeed, entity, entityList, variant, category, config.variantWeights));
               continue;
            }
            console.warn(`${logPrefix} Round ${i} [maths]: no question generated at all!`);
         }

         if (category === "english_language") {
            const entity = entityList.length > 0 ? getNextEntity() : null;
            chosenEntities.push(entity);
            console.log(`${logPrefix} Round ${i} [english]: entity=${entity?.label ?? "null"}`);
            const q = generateEnglishQuestion(roundSeed, entity, entityList, roundRng, variant, config.proceduralWeight);
            if (q) {
               console.log(`${logPrefix} Round ${i} [english]: generated procedural question type=${q.type}`);
               questions.push(q);
               continue;
            }
            if (entity) {
               console.log(`${logPrefix} Round ${i} [english]: falling back to entity question for ${entity.label}`);
               questions.push(generateQuestion(roundSeed, entity, entityList, variant, category, config.variantWeights));
               continue;
            }
            console.warn(`${logPrefix} Round ${i} [english]: no question generated at all!`);
         }

           // Standard entity-based procedural category logic
           if (entityList.length === 0) {
              console.log(`${logPrefix} Round ${i} [standard]: no entities — fallback to maths procedural`);
              const q = generateMathsQuestion(roundSeed, null, [], roundRng, variant, config.proceduralWeight);
              questions.push(q);
           } else {
              const entity = getNextEntity();
              chosenEntities.push(entity);
              console.log(`${logPrefix} Round ${i} [standard]: entity=${entity?.label ?? "null"}`);
              questions.push(generateQuestion(roundSeed, entity, entityList, variant, category, config.variantWeights));
           }

           console.log(`${logPrefix} Round ${i}: question generated successfully`);
        }

       console.log(`${logPrefix} Generated ${questions.length} questions total`);
       console.log(`${logPrefix} Chosen entities:`, chosenEntities.filter(Boolean).map((e: any) => e.label));

       // Encrypt and persist
       const plaintext = JSON.stringify(questions);
       console.log(`${logPrefix} Plaintext payload length: ${plaintext.length} chars`);
       const encryptionKey = await generateSecureSessionKey();
       console.log(`${logPrefix} Encryption key generated (${encryptionKey.length} chars)`);
       const encryptedQuestions = await encryptPayload(plaintext, encryptionKey);
       console.log(`${logPrefix} Payload encrypted (${encryptedQuestions.length} chars)`);

       console.log(`${logPrefix} Updating wordup_matches ${matchId} with questions and encryption_key`);
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
          console.log(`${logPrefix} Falling back to wordup_match_payloads insert`);
          const { error: payloadError } = await supabaseClient
             .from("wordup_match_payloads")
             .insert({ match_id: matchId, encrypted_payload: encryptedQuestions });
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
             console.log(`${logPrefix} Recording entity history for ${playerIds.length} user(s)`);
             const { error: historyError } = await supabaseClient
                .rpc("record_user_entities_seen", {
                   p_user_ids: playerIds,
                   p_entity_ids: validChosenEntityIds
                });

              if (historyError) {
                 console.error(`${logPrefix} Failed to record entity history:`, historyError);
              } else {
                 console.log(`${logPrefix} Entity history recorded`);
            }
         }
      }

       console.log(`${logPrefix} Returning success response`);
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
