/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRandomCuratedSentence } from "@/data/sentences";
import { getRandomWord, obfuscateWord } from "@/lib/game-logic";
import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import getMatchCount from "../helpers/getMatchCount";

const useCreateChallenge = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: async ({
         creatorId,
         mode,
         length,
         max_attempts,
         maxTime,
         invitedIds,
         isPublic = false,
         maxParticipants = null,
         isCustomWord = false,
         customWord = "",
         customWords = {},
         handicapStarter = null,
         handicapStarters = null,
         handicapEnforced = false,
         lifespanHours = 24,
         marathonTimers = null,
         marathonGames = null,
         marathonForceOrder = false,
         disableHints = false,
         isBotMarathon = false,
         is_bot_marathon,
         isShapeshifter = false,
         is_shapeshifter,
         difficulty = "normal",
         isSentences = false,
         sentenceWordCount = 5,
         customSentence = "",
         notifyCreator = false,
         notify_creator = false,
      }: any) => {
         const salt = Math.random().toString(36).substring(2, 15);
         const resolveDiff = (idx?: number) =>
            Array.isArray(difficulty)
               ? (difficulty[idx ?? 0] ?? "normal")
               : difficulty;
         let actualLength = length;
         let targetWord: string;
         const resolvedIsBotMarathon = !!(isBotMarathon || is_bot_marathon);

         if (resolvedIsBotMarathon) {
            const { count, error: countError } = await supabase
               .from("challenges")
               .select("id", { count: "exact", head: true })
               .eq("is_bot_marathon", true)
               .gt("expires_at", new Date().toISOString());

            if (countError) throw countError;
            if (count !== null && count >= 2) {
               throw new Error(
                  "Maximum of 2 daily bot marathons can run concurrently.",
               );
            }
         }

         const plainMarathonTargets: Record<number, string> = {};
         let plainRegularTarget = "";
         let resolvedMarathonGames =
            marathonGames || (length === 1 ? [3, 4, 5, 6, 7] : null);
         let sentenceWords: string[] | null = null;
         let effectiveForceOrder = marathonForceOrder;

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

         if (resolvedIsBotMarathon && resolvedMarathonGames) {
            const numDays = Math.ceil(lifespanHours / 24);
            const baseSequence = [...resolvedMarathonGames];
            const fullSequence: number[] = [];
            for (let d = 0; d < numDays; d++) {
               fullSequence.push(...baseSequence);
            }
            resolvedMarathonGames = fullSequence;
         }

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
                  } else if (customWords && typeof customWords === "object") {
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

         const isHandicapRandom =
            handicapStarter === "__SYSTEM_RANDOM__" ||
            (Array.isArray(handicapStarters) &&
               handicapStarters[0] === "__SYSTEM_RANDOM__");

         let finalHandicapStarter = handicapStarter;
         let finalHandicapStarters = handicapStarters;

         if (handicapStarter === "__SYSTEM_RANDOM__") {
            if (resolvedMarathonGames) {
               // Marathon
               const startersList: string[] = [];
               for (let idx = 0; idx < resolvedMarathonGames.length; idx++) {
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
                     await getRandomWord(actualLength, resolveDiff(), true)
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
                     await getRandomWord(actualLength, resolveDiff(), true)
                  ).toUpperCase();
                  limit++;
               }
               finalHandicapStarter = starter;
               finalHandicapStarters = null;
            }
         }

         const expiresAt = new Date();
         expiresAt.setHours(expiresAt.getHours() + lifespanHours);

         const { data: challenge, error: challengeError } = await supabase
            .from("challenges")
            .insert([
               {
                  creator_id: creatorId,
                  mode,
                  word_length: actualLength,
                  target_word: targetWord,
                  salt: salt,
                  max_attempts: max_attempts ?? 6,
                  max_time: maxTime,
                  expires_at: expiresAt.toISOString(),
                  is_public: isPublic,
                  max_participants: maxParticipants,
                  is_custom_word: isCustomWord,
                  handicap_starter: finalHandicapStarter,
                  handicap_starters: finalHandicapStarters,
                  handicap_enforced: handicapEnforced,
                  handicap_starter_is_random: isHandicapRandom,
                  disable_hints: disableHints,
                  marathon_timers: marathonTimers,
                  marathon_force_order: effectiveForceOrder,
                  is_bot_marathon: resolvedIsBotMarathon,
                  is_sentence: isSentences,
                  is_shapeshifter: !!(isShapeshifter || is_shapeshifter),
                  notify_creator: !!(notifyCreator || notify_creator),
               },
            ])
            .select()
            .single();

         if (challengeError) throw challengeError;

         const allParticipants = isCustomWord
            ? invitedIds.filter(
                 (id: string) =>
                    id !== creatorId &&
                    id !== "00000000-0000-0000-0000-000000000b0b",
              )
            : [creatorId, ...invitedIds].filter(
                 (id: string) => id !== "00000000-0000-0000-0000-000000000b0b",
              );

         const participantInserts = allParticipants.map((uid: string) => ({
            challenge_id: challenge.id,
            user_id: uid,
            status: "pending",
         }));

         if (participantInserts.length > 0) {
            await supabase
               .from("challenge_participants")
               .insert(participantInserts);
         }
         return challenge;
      },
      onSuccess: (_, variables) => {
         queryClient.invalidateQueries({
            queryKey: ["my-challenges", variables.creatorId],
         });
      },
   });
};

export default useCreateChallenge;
