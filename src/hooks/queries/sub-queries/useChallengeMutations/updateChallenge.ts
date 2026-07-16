/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRandomCuratedSentence } from "@/data/sentences";
import { getRandomWord, obfuscateWord } from "@/lib/game-logic";
import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import getMatchCount from "../helpers/getMatchCount";

const useUpdateChallenge = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         challengeId,
         params,
      }: {
         challengeId: string;
         params: any;
      }) => {
         const {
            mode,
            length,
            maxTime,
            isPublic,
            maxParticipants,
            isCustomWord,
            customWord,
            customWords,
            handicapStarter,
            handicapStarters,
            handicacpEnforced,
            handicapEnforced,
            marathonTimers,
            marathonGames,
            marathonForceOrder,
            lifespanHours,
            disableHints,
            isShapeshifter,
            is_shapeshifter,
            difficulty = "normal",
            isSentences = false,
            sentenceWordCount = 5,
            customSentence = "",
         } = params;

         const resolveDiff = (idx?: number) =>
            Array.isArray(difficulty)
               ? (difficulty[idx ?? 0] ?? "normal")
               : difficulty;

         // 1. Double check in client logic if anyone has played
         const { data: parts, error: partsError } = await supabase
            .from("challenge_participants")
            .select("id, status, attempts")
            .eq("challenge_id", challengeId);

         if (partsError) throw partsError;
         if (parts.some((p) => p.status !== "pending" && p.status !== "host")) {
            throw new Error(
               "Cannot edit challenge: a participant has already started playing.",
            );
         }

         // Fetch the existing challenge to compare length/custom/target word
         const { data: existing, error: existError } = await supabase
            .from("challenges")
            .select("*")
            .eq("id", challengeId)
            .single();

         if (existError) throw existError;

         let actualLength = length;
         let targetWord = existing.target_word;
         let salt = existing.salt;
         const plainMarathonTargets: Record<number, string> = {};
         let plainRegularTarget = "";

         const lengthChanged = existing.word_length !== length;
         const customChanged = existing.is_custom_word !== isCustomWord;
         let effectiveForceOrder = marathonForceOrder;

         let resolvedMarathonGames =
            marathonGames || (length === 1 ? [3, 4, 5, 6, 7] : null);
         let sentenceWords: string[] | null = null;

         if (isSentences) {
            actualLength = 1;
            effectiveForceOrder = true;
            if (isCustomWord) {
               sentenceWords = customSentence
                  .split(/\s+/)
                  .map((w: string) => w.trim().toUpperCase())
                  .filter(Boolean);
            } else {
               const curated = getRandomCuratedSentence(sentenceWordCount || 5);
               sentenceWords = curated ? curated : ["THE", "CAT", "SLEEPS"];
            }
            resolvedMarathonGames = sentenceWords!.map((w: string) => w.length);
         }

         // If length changed, custom status changed, or new custom word is provided:
         const shouldRegenerateTarget =
            lengthChanged ||
            customChanged ||
            isSentences ||
            (isCustomWord && (length === 1 ? !!customWords : !!customWord));

         if (shouldRegenerateTarget) {
            salt = Math.random().toString(36).substring(2, 15);
            if (resolvedMarathonGames) {
               const targetArray: { length: number; word: string }[] = [];
               const chosenWords = new Set<string>();
               for (let idx = 0; idx < resolvedMarathonGames.length; idx++) {
                  const l = resolvedMarathonGames[idx];
                  let rawWord = "";
                  if (sentenceWords && idx < sentenceWords.length) {
                     rawWord = sentenceWords[idx];
                  } else if (isCustomWord) {
                     if (Array.isArray(customWords)) {
                        rawWord = customWords[idx];
                     } else if (
                        customWords &&
                        typeof customWords === "object"
                     ) {
                        rawWord = customWords[l];
                     }
                  }
                  let word = (
                     rawWord || (await getRandomWord(l, resolveDiff(idx), true))
                  ).toUpperCase();
                  if (!rawWord) {
                     let limit = 0;
                     while (chosenWords.has(word) && limit < 200) {
                        word = (
                           await getRandomWord(l, resolveDiff(idx), true)
                        ).toUpperCase();
                        limit++;
                     }
                  }
                  chosenWords.add(word);
                  plainMarathonTargets[idx] = word;
                  targetArray.push({
                     length: l,
                     word: obfuscateWord(word, salt),
                  });
               }
               targetWord = JSON.stringify(targetArray);
            } else {
               actualLength =
                  length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
               const plainWord = (
                  customWord ||
                  (await getRandomWord(actualLength, resolveDiff(), true))
               ).toUpperCase();
               plainRegularTarget = plainWord;
               targetWord = obfuscateWord(plainWord, salt);
            }
         }

         let finalHandicapStarter = handicapStarter;
         let finalHandicapStarters = handicapStarters;
         let finalHandicapIsRandom: boolean;

         const isHandicap = params.isHandicap;

         if (isHandicap) {
            const isRandomRequest =
               handicapStarter === "__SYSTEM_RANDOM__" ||
               (Array.isArray(handicapStarters) &&
                  handicapStarters[0] === "__SYSTEM_RANDOM__");

            const isSingleMasked = handicapStarter === "__MASKED__";
            const isMultiMasked =
               Array.isArray(handicapStarters) &&
               handicapStarters[0] === "__MASKED__";

            if (isRandomRequest) {
               finalHandicapIsRandom = true;
               // Only generate new random starter if target word changed, or it wasn't random before
               const needsNewRandom =
                  shouldRegenerateTarget ||
                  !existing.handicap_starter_is_random ||
                  (!existing.handicap_starter && !existing.handicap_starters);

               if (needsNewRandom) {
                  if (resolvedMarathonGames) {
                     const startersList: string[] = [];
                     for (
                        let idx = 0;
                        idx < resolvedMarathonGames.length;
                        idx++
                     ) {
                        const l = resolvedMarathonGames[idx];
                        const target =
                           plainMarathonTargets[idx] ||
                           (
                              await getRandomWord(l, resolveDiff(idx), true)
                           ).toUpperCase();
                        const maxAllowed = l <= 4 ? 1 : 3;
                        let starter = (
                           await getRandomWord(l, resolveDiff(idx), true)
                        ).toUpperCase();
                        let limit = 0;
                        while (limit < 200) {
                           if (
                              starter !== target &&
                              getMatchCount(starter, target) <= maxAllowed
                           ) {
                              break;
                           }
                           starter = (
                              await getRandomWord(l, resolveDiff(idx), true)
                           ).toUpperCase();
                           limit++;
                        }
                        startersList.push(starter);
                     }
                     finalHandicapStarters = startersList;
                     finalHandicapStarter = null;
                  } else {
                     const target =
                        plainRegularTarget ||
                        (
                           await getRandomWord(
                              actualLength,
                              resolveDiff(),
                              true,
                           )
                        ).toUpperCase();
                     const maxAllowed = actualLength <= 4 ? 1 : 3;
                     let starter = (
                        await getRandomWord(actualLength, resolveDiff(), true)
                     ).toUpperCase();
                     let limit = 0;
                     while (limit < 200) {
                        if (
                           starter !== target &&
                           getMatchCount(starter, target) <= maxAllowed
                        ) {
                           break;
                        }
                        starter = (
                           await getRandomWord(
                              actualLength,
                              resolveDiff(),
                              true,
                           )
                        ).toUpperCase();
                        limit++;
                     }
                     finalHandicapStarter = starter;
                     finalHandicapStarters = null;
                  }
               } else {
                  // Keep existing random ones
                  finalHandicapStarter = existing.handicap_starter;
                  finalHandicapStarters = existing.handicap_starters;
               }
            } else {
               // Custom word starter
               finalHandicapIsRandom = false;
               if (isSingleMasked) {
                  finalHandicapStarter = existing.handicap_starter;
               }
               if (isMultiMasked) {
                  finalHandicapStarters = existing.handicap_starters;
               }
            }
         } else {
            finalHandicapStarter = null;
            finalHandicapStarters = null;
            finalHandicapIsRandom = false;
         }

         const updateData: any = {
            mode,
            word_length: actualLength,
            target_word: targetWord,
            salt,
            max_time: maxTime,
            is_public: isPublic,
            max_participants: maxParticipants,
            is_custom_word: isCustomWord,
            handicap_starter: finalHandicapStarter,
            handicap_starters: finalHandicapStarters,
            handicap_starter_is_random: finalHandicapIsRandom,
            handicap_enforced:
               (handicapEnforced || handicacpEnforced) && isHandicap,
            disable_hints:
               disableHints !== undefined
                  ? disableHints
                  : existing.disable_hints,
            marathon_timers: marathonTimers,
            marathon_force_order: effectiveForceOrder,
            is_sentence: isSentences,
            is_shapeshifter: !!(isShapeshifter || is_shapeshifter),
         };

         if (lifespanHours) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + lifespanHours);
            updateData.expires_at = expiresAt.toISOString();
         }

         const { data: challenge, error: challengeError } = await supabase
            .from("challenges")
            .update(updateData)
            .eq("id", challengeId)
            .select()
            .single();

         if (challengeError) throw challengeError;

         // Update participants list.
         // 1. Delete all existing pending participants
         const creatorId = challenge.creator_id;
         const { error: delError } = await supabase
            .from("challenge_participants")
            .delete()
            .eq("challenge_id", challengeId)
            .neq("status", "host")
            .eq("status", "pending");

         if (delError) throw delError;

         // 2. Insert new list of pending participants
         const allParticipants = isCustomWord
            ? params.invitedIds.filter((id: string) => id !== creatorId)
            : [
                 creatorId,
                 ...params.invitedIds.filter((id: string) => id !== creatorId),
              ];

         const participantInserts = allParticipants.map((uid: string) => ({
            challenge_id: challengeId,
            user_id: uid,
            status: "pending",
         }));

         if (participantInserts.length > 0) {
            const { error: insertError } = await supabase
               .from("challenge_participants")
               .insert(participantInserts);
            if (insertError) throw insertError;
         }

         return challenge;
      },
      onSuccess: (data, variables) => {
         queryClient.invalidateQueries({
            queryKey: ["my-challenges", data.creator_id],
         });
         queryClient.invalidateQueries({
            queryKey: ["challenge", variables.challengeId],
         });
      },
   });
};

export default useUpdateChallenge;
