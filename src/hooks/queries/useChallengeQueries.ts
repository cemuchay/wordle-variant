/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { getRandomWord, obfuscateWord } from "../../lib/game-logic";
import { type Challenge } from "../useChallenge";
import { safeLocalStorage, safeSessionStorage } from "../../utils/storage";

export const mapParticipant = (p: any) => {
  if (!p) return p;
  return {
    ...p,
    profiles: p.profiles || p.guest_profiles || null,
  };
};

export const mapChallenge = (challenge: any) => {
  if (!challenge) return challenge;
  return {
    ...challenge,
    creator: challenge.creator || challenge.guest_creator || null,
    participants: challenge.participants?.map(mapParticipant) || [],
  };
};

export const mapParticipation = (participation: any) => {
  if (!participation) return participation;
  return {
    ...mapParticipant(participation),
    challenge: mapChallenge(participation.challenge),
  };
};

/**
 * Hook to fetch all challenges a user is participating in.
 */
export const useMyChallenges = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["my-challenges", userId],
    queryFn: async () => {
      // Retrieve recent challenges from localStorage
      let recentIds: string[] = [];
      try {
        const stored = safeLocalStorage.getItem("wordle_recent_challenges");
        if (stored) {
          recentIds = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to parse recent challenges", e);
      }

      if (!userId && recentIds.length === 0) return [];

      let participations: any[] = [];
      let createdChallenges: any[] = [];

      if (userId) {
        // 1. Fetch all challenges I am a participant in
        const { data: pData, error: pError } = await supabase
          .from("challenge_participants")
          .select(
            `
                        *,
                        guest_profiles(username, avatar_url),
                        profiles(username, avatar_url),
                        marathon_progress:challenge_participants_marathon(*),
                        challenge:challenges(
                            *,
                            creator:profiles!creator_id(username, avatar_url),
                            participants:challenge_participants(
                                *,
                                profiles(username, avatar_url),
                                guest_profiles(username, avatar_url),
                                marathon_progress:challenge_participants_marathon(*)
                            )
                        )
                    `,
          )
          .or(`user_id.eq.${userId},guest_id.eq.${userId}`);

        if (pError) throw pError;
        participations = pData || [];

        // 2. Fetch all challenges I created
        const { data: cData, error: cError } = await supabase
          .from("challenges")
          .select(
            `
                        *,
                        creator:profiles!creator_id(username, avatar_url),
                        participants:challenge_participants(
                            *,
                            profiles(username, avatar_url),
                            guest_profiles(username, avatar_url),
                            marathon_progress:challenge_participants_marathon(*)
                        )
                    `,
          )
          .eq("creator_id", userId);

        if (cError) throw cError;
        createdChallenges = cData || [];
      }

      // 3. Merge them. If I'm both creator and participant, Query 1 has the full record.
      const finalResults = participations.map(mapParticipation);
      const participatedIds = new Set(finalResults.map((p) => p.challenge_id));

      createdChallenges?.forEach((challenge) => {
        const mappedChallenge = mapChallenge(challenge);
        if (!participatedIds.has(mappedChallenge.id)) {
          // Synthetic participation record for creators who aren't playing
          finalResults.push({
            id: `host-${mappedChallenge.id}`,
            challenge_id: mappedChallenge.id,
            user_id: userId || null,
            status: "host", // Special frontend-only status
            score: 0,
            attempts: 0,
            guesses: [],
            challenge: mappedChallenge,
          });
        }
      });

      // 4. Fetch details for missing recently viewed challenges
      const missingIds = recentIds.filter((id) => !participatedIds.has(id));
      if (missingIds.length > 0) {
        const { data: recentChallenges, error: rError } = await supabase
          .from("challenges")
          .select(
            `
                        *,
                        creator:profiles!creator_id(username, avatar_url),
                        participants:challenge_participants(
                            *,
                            profiles(username, avatar_url),
                            guest_profiles(username, avatar_url),
                            marathon_progress:challenge_participants_marathon(*)
                        )
                    `,
          )
          .in("id", missingIds);

        if (!rError && recentChallenges) {
          recentChallenges.forEach((challenge) => {
            const mappedChallenge = mapChallenge(challenge);
            finalResults.push({
              id: `viewed-${challenge.id}`,
              challenge_id: challenge.id,
              user_id: userId || null,
              status: "viewed", // Special status for viewed-only challenges
              score: 0,
              attempts: 0,
              guesses: [],
              challenge: mappedChallenge,
            });
          });
        }
      }

      const sortedResults = finalResults.sort((a, b) => {
        const dateA = new Date(a.challenge.created_at).getTime();
        const dateB = new Date(b.challenge.created_at).getTime();
        return dateB - dateA;
      });

      if (userId) {
        try {
          safeSessionStorage.setItem(
            `wordle_my_challenges_${userId}`,
            JSON.stringify(sortedResults),
          );
        } catch (e) {
          console.error("Failed to cache challenges list", e);
        }
      }

      return sortedResults;
    },
    enabled: true,
    initialData: () => {
      if (!userId) return [];
      try {
        const cached = safeSessionStorage.getItem(`wordle_my_challenges_${userId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {
        console.error("Failed to load initial challenges cache", e);
      }
      return undefined;
    },
  });
};

/**
 * Hook to fetch all user profiles (for invitations).
 */
export const useAvailableProfiles = (currentUserId: string | undefined) => {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url");
      if (error) throw error;
      return data.filter((p) => p.id !== currentUserId);
    },
    enabled: !!currentUserId,
  });
};

/**
 * Hook to fetch a specific challenge by ID.
 */
export const useChallengeData = (challengeId: string | null) => {
  return useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: async () => {
      if (!challengeId) return null;
      const { data: edgeRes, error } = await supabase.functions.invoke(
        "redis-cache",
        {
          body: { action: "get-challenge", challengeId },
        },
      );
      if (error) throw error;
      const mapped = mapChallenge(edgeRes?.data) as Challenge;
      try {
        safeSessionStorage.setItem(
          `wordle_challenge_detail_${challengeId}`,
          JSON.stringify(mapped),
        );
      } catch (e) {
        console.error("Failed to cache challenge details", e);
      }
      return mapped;
    },
    enabled: !!challengeId,
    initialData: () => {
      if (!challengeId) return undefined;
      try {
        const cached = safeSessionStorage.getItem(
          `wordle_challenge_detail_${challengeId}`,
        );
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {
        console.error("Failed to load initial challenge detail cache", e);
      }
      return undefined;
    },
  });
};

/**
 * Hook to fetch all active public challenges for discovery.
 */
export const useDiscoverChallenges = () => {
  return useQuery({
    queryKey: ["discover-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select(
          `
                    *,
                    creator:profiles!creator_id(username, avatar_url),
                    participants:challenge_participants(
                        *,
                        profiles(username, avatar_url),
                        guest_profiles(username, avatar_url),
                        marathon_progress:challenge_participants_marathon(*)
                    )
                `,
        )
        .or(`is_public.eq.true,is_bot_marathon.eq.true`)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(mapChallenge);
    },
  });
};

/**
 * Helper to count yellow + green matches between a starter word and a target word.
 */
function getMatchCount(starter: string, target: string): number {
  const s = starter.toUpperCase().split("");
  const t = target.toUpperCase().split("");
  let matches = 0;

  // First pass: correct matches (green)
  s.forEach((char, i) => {
    if (char === t[i]) {
      matches++;
      s[i] = "_";
      t[i] = "_";
    }
  });

  // Second pass: present matches (yellow)
  s.forEach((char) => {
    if (char !== "_") {
      const idx = t.indexOf(char);
      if (idx !== -1) {
        matches++;
        t[idx] = "_";
      }
    }
  });

  return matches;
}

/**
 * Mutations for Challenge Lifecycle
 */
export const useChallengeMutations = () => {
  const queryClient = useQueryClient();

  const createChallenge = useMutation({
    mutationFn: async ({
      creatorId,
      mode,
      length,
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
    }: any) => {
      const salt = Math.random().toString(36).substring(2, 15);
      let actualLength = length;
      let targetWord: string;

      const plainMarathonTargets: Record<number, string> = {};
      let plainRegularTarget = "";

      const resolvedMarathonGames =
        marathonGames || (length === 1 ? [3, 4, 5, 6, 7] : null);

      if (resolvedMarathonGames) {
        const targetArray: { length: number; word: string }[] = [];
        resolvedMarathonGames.forEach((l: number, idx: number) => {
          let rawWord = "";
          if (isCustomWord) {
            if (Array.isArray(customWords)) {
              rawWord = customWords[idx];
            } else if (customWords && typeof customWords === "object") {
              rawWord = customWords[l];
            }
          }
          const word = (rawWord || getRandomWord(l)).toUpperCase();
          plainMarathonTargets[idx] = word;
          targetArray.push({
            length: l,
            word: obfuscateWord(word, salt),
          });
        });
        targetWord = JSON.stringify(targetArray);
      } else {
        actualLength =
          length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
        const plainWord = (
          customWord || getRandomWord(actualLength)
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
          resolvedMarathonGames.forEach((l: number, idx: number) => {
            const target =
              plainMarathonTargets[idx] || getRandomWord(l).toUpperCase();
            const maxAllowed = l <= 4 ? 1 : 3;
            let starter = getRandomWord(l).toUpperCase();
            let limit = 0;
            while (limit < 200) {
              if (
                starter !== target &&
                getMatchCount(starter, target) <= maxAllowed
              ) {
                break;
              }
              starter = getRandomWord(l).toUpperCase();
              limit++;
            }
            startersList.push(starter);
          });
          finalHandicapStarters = startersList;
          finalHandicapStarter = null;
        } else {
          const target =
            plainRegularTarget || getRandomWord(actualLength).toUpperCase();
          const maxAllowed = actualLength <= 4 ? 1 : 3;
          let starter = getRandomWord(actualLength).toUpperCase();
          let limit = 0;
          while (limit < 200) {
            if (
              starter !== target &&
              getMatchCount(starter, target) <= maxAllowed
            ) {
              break;
            }
            starter = getRandomWord(actualLength).toUpperCase();
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
            marathon_force_order: marathonForceOrder,
            is_bot_marathon: isBotMarathon,
          },
        ])
        .select()
        .single();

      if (challengeError) throw challengeError;

      const allParticipants = isCustomWord
        ? invitedIds.filter((id: string) => id !== creatorId)
        : [creatorId, ...invitedIds.filter((id: string) => id !== creatorId)];

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

  const submitResult = useMutation({
    mutationFn: async ({ participationId, result }: any) => {
      const updateData: any = { ...result };
      if (result?.status && result.status !== "playing") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("challenge_participants")
        .update(updateData)
        .eq("id", participationId);

      if (error) throw error;
      return true;
    },
    onSuccess: (_, variables) => {
      if (variables?.result?.status !== "playing") {
        queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
        queryClient.invalidateQueries({ queryKey: ["challenge"] });
      }
    },
  });

  const joinChallenge = useMutation({
    mutationFn: async ({
      challengeId,
      userId,
      isGuest = false,
    }: {
      challengeId: string;
      userId: string;
      isGuest?: boolean;
    }) => {
      // First check if already participating
      const { data: existing, error: fetchError } = await supabase
        .from("challenge_participants")
        .select(
          "*, challenge:challenges(*), marathon_progress:challenge_participants_marathon(*)",
        )
        .eq("challenge_id", challengeId)
        .eq(isGuest ? "guest_id" : "user_id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (existing) return existing;

      // Fetch challenge details to validate participation limits
      const { data: challenge, error: chalError } = await supabase
        .from("challenges")
        .select("*, participants:challenge_participants(id)")
        .eq("id", challengeId)
        .single();

      if (chalError) throw chalError;

      // Check guest/user permission if private
      const isCreator = challenge.creator_id === userId;
      if (!challenge.is_public && !isCreator) {
        throw new Error(
          "This is a private challenge. You must be invited to join.",
        );
      }

      // Check participant limit
      const maxParts = challenge.max_participants || 100;
      const currentParts = challenge.participants?.length || 0;
      if (currentParts >= maxParts) {
        throw new Error("Challenge participant limit reached.");
      }

      // If not, then join as pending
      const insertData: any = {
        challenge_id: challengeId,
        status: "pending",
      };
      if (isGuest) {
        insertData.guest_id = userId;
      } else {
        insertData.user_id = userId;
      }

      const { data, error } = await supabase
        .from("challenge_participants")
        .insert([insertData])
        .select(
          "*, challenge:challenges(*), marathon_progress:challenge_participants_marathon(*)",
        )
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
    },
  });

  const startChallenge = useMutation({
    mutationFn: async (participationId: string) => {
      const { error } = await supabase
        .from("challenge_participants")
        .update({
          status: "playing",
          started_at: new Date().toISOString(),
        })
        .eq("id", participationId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenge"] });
    },
  });

  const submitMarathonResult = useMutation({
    mutationFn: async ({
      participationId,
      challengeId,
      gameIndex,
      wordLength,
      result,
      playDate,
    }: {
      participationId: string;
      challengeId: string;
      gameIndex?: number;
      wordLength: number;
      result: any;
      playDate?: string;
    }) => {
      const resolvedGameIndex =
        gameIndex !== undefined ? gameIndex : wordLength - 3;
      const data: any = {
        participation_id: participationId,
        challenge_id: challengeId,
        game_index: resolvedGameIndex,
        word_length: wordLength,
        play_date: playDate || "1970-01-01",
        ...result,
      };

      if (result?.status && result.status !== "playing") {
        data.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("challenge_participants_marathon")
        .upsert(data, { onConflict: "participation_id, game_index, play_date" });

      if (error) throw error;
      return true;
    },

    onSuccess: (_, variables) => {
      if (variables?.result?.status !== "playing") {
        queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
        queryClient.invalidateQueries({ queryKey: ["challenge"] });
      }
    },
  });

  const updateChallenge = useMutation({
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
      } = params;

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
      const lengthChanged = existing.word_length !== length;
      const customChanged = existing.is_custom_word !== isCustomWord;
      const resolvedMarathonGames =
        marathonGames || (length === 1 ? [3, 4, 5, 6, 7] : null);

      const plainMarathonTargets: Record<number, string> = {};
      let plainRegularTarget = "";

      // If length changed, custom status changed, or new custom word is provided:
      const shouldRegenerateTarget =
        lengthChanged ||
        customChanged ||
        (isCustomWord && (length === 1 ? !!customWords : !!customWord));

      if (shouldRegenerateTarget) {
        salt = Math.random().toString(36).substring(2, 15);
        if (resolvedMarathonGames) {
          const targetArray: { length: number; word: string }[] = [];
          resolvedMarathonGames.forEach((l: number, idx: number) => {
            let rawWord = "";
            if (isCustomWord) {
              if (Array.isArray(customWords)) {
                rawWord = customWords[idx];
              } else if (customWords && typeof customWords === "object") {
                rawWord = customWords[l];
              }
            }
            const word = (rawWord || getRandomWord(l)).toUpperCase();
            plainMarathonTargets[idx] = word;
            targetArray.push({
              length: l,
              word: obfuscateWord(word, salt),
            });
          });
          targetWord = JSON.stringify(targetArray);
        } else {
          actualLength =
            length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
          const plainWord = (
            customWord || getRandomWord(actualLength)
          ).toUpperCase();
          plainRegularTarget = plainWord;
          targetWord = obfuscateWord(plainWord, salt);
        }
      }

      let finalHandicapStarter = handicapStarter;
      let finalHandicapStarters = handicapStarters;
      let finalHandicapIsRandom = existing.handicap_starter_is_random;

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
              resolvedMarathonGames.forEach((l: number, idx: number) => {
                const target =
                  plainMarathonTargets[idx] || getRandomWord(l).toUpperCase();
                const maxAllowed = l <= 4 ? 1 : 3;
                let starter = getRandomWord(l).toUpperCase();
                let limit = 0;
                while (limit < 200) {
                  if (
                    starter !== target &&
                    getMatchCount(starter, target) <= maxAllowed
                  ) {
                    break;
                  }
                  starter = getRandomWord(l).toUpperCase();
                  limit++;
                }
                startersList.push(starter);
              });
              finalHandicapStarters = startersList;
              finalHandicapStarter = null;
            } else {
              let target =
                plainRegularTarget || getRandomWord(actualLength).toUpperCase();
              const maxAllowed = actualLength <= 4 ? 1 : 3;
              let starter = getRandomWord(actualLength).toUpperCase();
              let limit = 0;
              while (limit < 200) {
                if (
                  starter !== target &&
                  getMatchCount(starter, target) <= maxAllowed
                ) {
                  break;
                }
                starter = getRandomWord(actualLength).toUpperCase();
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
          disableHints !== undefined ? disableHints : existing.disable_hints,
        marathon_timers: marathonTimers,
        marathon_force_order: marathonForceOrder,
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

  const deleteChallenge = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from("challenges")
        .delete()
        .eq("id", challengeId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenge"] });
    },
  });

  return {
    createChallenge,
    submitResult,
    joinChallenge,
    startChallenge,
    submitMarathonResult,
    updateChallenge,
    deleteChallenge,
  };
};
