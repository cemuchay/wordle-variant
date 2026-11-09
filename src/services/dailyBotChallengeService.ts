/* eslint-disable @typescript-eslint/no-explicit-any */
import {
   generateHandicapStarters,
   type HandicapLevel,
   type HandicapRows,
} from "../hooks/queries/sub-queries/helpers/handicapStarters";
import { getRandomWord, obfuscateWord } from "../lib/game-logic";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabaseClient";
import { safeLocalStorage } from "../utils/storage";

export interface BotMarathonPreset {
   id: string;
   name: string;
   description: string;
   wordLengths: number[]; // Default base sequence (4 to 7 games per day)
   wordLengthOptions?: number[][]; // Dynamic variations of lengths to randomly select from
   maxAttempts: number;
   maxAttemptOptions?: number[]; // Dynamic variations of max attempts
   difficulty: "easy" | "normal" | ("easy" | "normal")[];
   difficultyOptions?: ("easy" | "normal" | ("easy" | "normal")[])[];
   disableHints?: boolean;
   disableHintOptions?: boolean[];
   marathonForceOrder?: boolean;
   marathonForceOrderOptions?: boolean[];
   isHandicap?: boolean;
   handicapEnforced?: boolean;
   handicapLevel?: HandicapLevel;
   handicapRows?: HandicapRows;
   handicapOptions?: {
      isHandicap: boolean;
      handicapEnforced?: boolean;
      handicapLevel?: HandicapLevel;
      handicapRows?: HandicapRows;
   }[];
   marathonTimers?: number[] | null;
}

export interface ResolvedBotPreset {
   id: string;
   name: string;
   description: string;
   wordLengths: number[];
   maxAttempts: number;
   difficulty: "easy" | "normal" | ("easy" | "normal")[];
   disableHints: boolean;
   marathonForceOrder: boolean;
   isHandicap: boolean;
   handicapEnforced: boolean;
   handicapLevel?: HandicapLevel;
   handicapRows?: HandicapRows;
   marathonTimers?: number[] | null;
}

/**
 * Resolves a preset by randomly selecting among its dynamic variation options (Layer 2)
 * so that every time a preset is picked, its exact play configuration feels fresh.
 */
export function resolvePresetVariations(
   preset: BotMarathonPreset,
): ResolvedBotPreset {
   const pick = <T>(options: T[] | undefined, fallback: T): T => {
      if (options && options.length > 0) {
         return options[Math.floor(Math.random() * options.length)];
      }
      return fallback;
   };

   const wordLengths = pick(preset.wordLengthOptions, preset.wordLengths);
   const maxAttempts = pick(preset.maxAttemptOptions, preset.maxAttempts);
   const difficulty = pick(preset.difficultyOptions, preset.difficulty);
   const disableHints = pick(preset.disableHintOptions, !!preset.disableHints);
   const marathonForceOrder = pick(
      preset.marathonForceOrderOptions,
      !!preset.marathonForceOrder,
   );

   const defaultHandicap = {
      isHandicap: !!preset.isHandicap,
      handicapEnforced: !!preset.handicapEnforced,
      handicapLevel: preset.handicapLevel,
      handicapRows: preset.handicapRows,
   };
   const handicap = pick(preset.handicapOptions, defaultHandicap);

   return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      wordLengths,
      maxAttempts,
      difficulty,
      disableHints,
      marathonForceOrder,
      isHandicap: handicap.isHandicap,
      handicapEnforced: !!handicap.handicapEnforced,
      handicapLevel: handicap.handicapLevel,
      handicapRows: handicap.handicapRows,
      marathonTimers: preset.marathonTimers,
   };
}

export const BOT_MARATHON_PRESETS: BotMarathonPreset[] = [
   {
      id: "standard-escalation",
      name: "Standard Escalation",
      description: "Classic progression from 4 to 7 letter words.",
      wordLengths: [4, 5, 6, 7],
      wordLengthOptions: [
         [4, 5, 6, 7],
         [4, 5, 5, 6, 7],
         [4, 4, 5, 6, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [5, 6],
      difficulty: "normal",
      difficultyOptions: ["normal", ["easy", "normal", "normal", "normal"]],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
      isHandicap: false,
      handicapOptions: [
         { isHandicap: false },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "easy",
            handicapRows: 1,
         },
      ],
   },
   {
      id: "speed-sprint",
      name: "Speed Sprint",
      description:
         "Brisk 5-game sprint with accessible lengths and tighter attempts.",
      wordLengths: [4, 4, 5, 5, 6],
      wordLengthOptions: [
         [4, 4, 5, 5, 6],
         [4, 5, 5, 5, 6],
         [4, 4, 4, 5, 6],
      ],
      maxAttempts: 5,
      maxAttemptOptions: [5, 6],
      difficulty: "easy",
      difficultyOptions: ["easy", "normal"],
      marathonForceOrder: false,
      marathonForceOrderOptions: [false, true],
      isHandicap: false,
      handicapOptions: [
         { isHandicap: false },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "easy",
            handicapRows: 1,
         },
      ],
   },
   {
      id: "grand-gauntlet",
      name: "Grand Gauntlet",
      description:
         "Max 7 games challenge testing full endurance with flexible play order.",
      wordLengths: [4, 5, 5, 6, 6, 7, 7],
      wordLengthOptions: [
         [4, 5, 5, 6, 6, 7, 7],
         [4, 4, 5, 5, 6, 6, 7],
         [5, 5, 6, 6, 7, 7, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [6, 7],
      difficulty: "normal",
      difficultyOptions: ["normal", "easy"],
      marathonForceOrder: false,
      marathonForceOrderOptions: [false, true],
      isHandicap: true,
      handicapEnforced: false,
      handicapLevel: "easy",
      handicapRows: 1,
      handicapOptions: [
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "easy",
            handicapRows: 1,
         },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "normal",
            handicapRows: 1,
         },
         { isHandicap: false },
      ],
   },
   {
      id: "mystery-trial",
      name: "Mystery Trial",
      description:
         "Progressive ladder with hints disabled to test pure deduction.",
      wordLengths: [4, 5, 6, 6, 7],
      wordLengthOptions: [
         [4, 5, 6, 6, 7],
         [4, 5, 5, 6, 7],
         [4, 4, 5, 6, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [5, 6],
      difficulty: "normal",
      disableHints: true,
      disableHintOptions: [true],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
      isHandicap: false,
      handicapOptions: [
         { isHandicap: false },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "easy",
            handicapRows: 1,
         },
      ],
   },
   {
      id: "climbing-ladder",
      name: "Climbing Ladder",
      description:
         "Steady 5-stage progression with accessible standard vocabulary and 6 attempts.",
      wordLengths: [4, 5, 5, 6, 7],
      wordLengthOptions: [
         [4, 5, 5, 6, 7],
         [4, 5, 6, 6, 7],
         [4, 5, 6, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [6, 7],
      difficulty: "normal",
      difficultyOptions: ["normal", "easy"],
      disableHints: false,
      disableHintOptions: [false, true],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
   },
   {
      id: "handicap-showdown",
      name: "Handicap Showdown",
      description:
         "Enforced random starter row on every game to test adaptability.",
      wordLengths: [4, 5, 6, 7],
      wordLengthOptions: [
         [4, 5, 6, 7],
         [4, 5, 5, 6, 7],
         [4, 4, 5, 6],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [5, 6],
      difficulty: "normal",
      difficultyOptions: ["normal", "easy"],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
      isHandicap: true,
      handicapEnforced: true,
      handicapLevel: "normal",
      handicapRows: 1,
      handicapOptions: [
         {
            isHandicap: true,
            handicapEnforced: true,
            handicapLevel: "normal",
            handicapRows: 1,
         },
         {
            isHandicap: true,
            handicapEnforced: true,
            handicapLevel: "easy",
            handicapRows: 1,
         },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "normal",
            handicapRows: 1,
         },
      ],
   },
   {
      id: "pentathlon",
      name: "Pentathlon Mix",
      description:
         "5 varied stages mixing quick 4-letter words with longer challenges.",
      wordLengths: [4, 4, 5, 6, 7],
      wordLengthOptions: [
         [4, 4, 5, 6, 7],
         [4, 5, 5, 6, 7],
         [4, 5, 6, 7, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [5, 6],
      difficulty: ["easy", "easy", "normal", "normal", "normal"],
      difficultyOptions: [
         ["easy", "easy", "normal", "normal", "normal"],
         "normal",
         "easy",
      ],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
      handicapOptions: [
         { isHandicap: false },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "easy",
            handicapRows: 1,
         },
      ],
   },
   {
      id: "double-six-endurance",
      name: "Double-Six Endurance",
      description:
         "6 heavy games focusing on 5, 6, and 7 letter challenges with optional starters.",
      wordLengths: [5, 6, 6, 6, 7, 7],
      wordLengthOptions: [
         [5, 6, 6, 6, 7, 7],
         [4, 5, 6, 6, 7, 7],
         [5, 5, 6, 6, 7, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [6, 7],
      difficulty: "normal",
      difficultyOptions: ["normal", "easy"],
      marathonForceOrder: false,
      marathonForceOrderOptions: [false, true],
      isHandicap: true,
      handicapEnforced: false,
      handicapLevel: "normal",
      handicapRows: 1,
      handicapOptions: [
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "normal",
            handicapRows: 1,
         },
         {
            isHandicap: true,
            handicapEnforced: true,
            handicapLevel: "easy",
            handicapRows: 1,
         },
         { isHandicap: false },
      ],
   },
   {
      id: "sudden-death",
      name: "Sudden Death",
      description: "Only 4 attempts per game, aided by a helpful starter row.",
      wordLengths: [4, 5, 6, 7],
      wordLengthOptions: [
         [4, 5, 6, 7],
         [4, 4, 5, 6],
         [4, 5, 5, 6],
      ],
      maxAttempts: 4,
      maxAttemptOptions: [4, 5],
      difficulty: "normal",
      difficultyOptions: ["normal", "easy"],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
      isHandicap: true,
      handicapEnforced: true,
      handicapLevel: "easy",
      handicapRows: 1,
      handicapOptions: [
         {
            isHandicap: true,
            handicapEnforced: true,
            handicapLevel: "easy",
            handicapRows: 1,
         },
         {
            isHandicap: true,
            handicapEnforced: true,
            handicapLevel: "easy",
            handicapRows: 2,
         },
      ],
   },
   {
      id: "hexagon-clash",
      name: "Hexagon Clash",
      description:
         "6 stages with escalating lengths and strict ordered progression.",
      wordLengths: [4, 5, 5, 6, 7, 7],
      wordLengthOptions: [
         [4, 5, 5, 6, 7, 7],
         [4, 4, 5, 6, 6, 7],
         [4, 5, 6, 6, 7, 7],
      ],
      maxAttempts: 6,
      maxAttemptOptions: [5, 6],
      difficulty: "normal",
      difficultyOptions: [
         "normal",
         ["easy", "normal", "normal", "normal", "normal", "normal"],
      ],
      marathonForceOrder: true,
      marathonForceOrderOptions: [true, false],
      handicapOptions: [
         { isHandicap: false },
         {
            isHandicap: true,
            handicapEnforced: false,
            handicapLevel: "easy",
            handicapRows: 1,
         },
      ],
   },
];

/**
 * In-memory guardrail to prevent multiple concurrent execution promises within the same app session.
 */
let isAutoCreating = false;

/**
 * Checks whether it is Sunday in Africa/Lagos timezone (UTC+1).
 */
export function isLagosSunday(date = new Date()): boolean {
   const lagosDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      weekday: "short",
   }).format(date);
   return lagosDay.toLowerCase().startsWith("sun");
}

/**
 * Computes next Monday 00:00:00 UTC and next Sunday 23:59:59 UTC relative to current Lagos Sunday.
 */
export function getNextWeekSpan(now = new Date()): {
   nextMonday: Date;
   nextSunday: Date;
} {
   const lagosOffset = 1 * 60 * 60 * 1000;
   const lagosNow = new Date(now.getTime() + lagosOffset);

   const daysUntilMonday = (8 - lagosNow.getUTCDay()) % 7 || 7;
   const nextMonday = new Date(
      lagosNow.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000,
   );
   nextMonday.setUTCHours(0, 0, 0, 0);

   const nextSunday = new Date(nextMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
   nextSunday.setUTCHours(23, 59, 59, 999);

   return { nextMonday, nextSunday };
}

/**
 * Generates and saves the weekly 7-day Daily Bot Challenge using the exact ChallengeCreate schema
 * (word_length: 1, salt, JSON-encoded obfuscated 7-day target_word sequence, and handicap_starters)
 * completely in the background without needing Supabase edge functions or server cron jobs.
 */
export async function autoCreateWeeklyBotChallenge(): Promise<boolean> {
   const BOT_CREATOR_ID = "00000000-0000-0000-0000-000000000b0b";
   const now = new Date();

   // Guardrail 1: In-memory lock (prevents double invocation from React StrictMode & re-renders)
   if (isAutoCreating) {
      return false;
   }

   // 1. Check if today is Sunday in Lagos
   if (!isLagosSunday(now)) {
      return false;
   }

   const { nextMonday } = getNextWeekSpan(now);
   const weekKey = `bot_marathon_${nextMonday.toISOString().split("T")[0]}`;
   const lockKey = `${weekKey}_lock`;

   // Guardrail 2: Short-lived cross-tab acquisition lock (5 minutes timeout)
   const existingLockTime = safeLocalStorage.getItem(lockKey);
   if (
      existingLockTime &&
      Date.now() - Number(existingLockTime) < 5 * 60 * 1000
   ) {
      return false;
   }

   isAutoCreating = true;
   safeLocalStorage.setItem(lockKey, String(Date.now()));

   try {
      // Query database to verify truth: does an active or upcoming bot marathon actually exist in Supabase?
      const { data: activeBotChallenges, error: checkError } = await supabase
         .from("challenges")
         .select("id, created_at, expires_at")
         .eq("is_bot_marathon", true)
         .gt("expires_at", now.toISOString());

      if (checkError) throw checkError;

      // If 2 or more are already active, or if one was already created in the last 36 hours (this Sunday),
      // sync the localStorage key and abort
      const recentThreshold = now.getTime() - 36 * 60 * 60 * 1000;
      const alreadyCreatedThisWeekend = (activeBotChallenges || []).some(
         (c: any) => new Date(c.created_at).getTime() >= recentThreshold,
      );

      if (
         (activeBotChallenges && activeBotChallenges.length >= 2) ||
         alreadyCreatedThisWeekend
      ) {
         safeLocalStorage.setItem(weekKey, "created");
         safeLocalStorage.removeItem(lockKey);
         isAutoCreating = false;
         return false;
      }

      // Phantom key self-healing: if localStorage thought it was created, but DB confirmed it does NOT exist, clear it
      if (safeLocalStorage.getItem(weekKey) === "created") {
         logger.info(
            "[BotMarathon] Clearing phantom localStorage key as no challenge exists in database:",
            weekKey,
         );
         safeLocalStorage.removeItem(weekKey);
      }

      // 2. Pick a random preset from the 10 presets and resolve its dynamic variation (Layer 2)
      const basePreset =
         BOT_MARATHON_PRESETS[
            Math.floor(Math.random() * BOT_MARATHON_PRESETS.length)
         ];
      const preset = resolvePresetVariations(basePreset);
      logger.info(
         `[BotMarathon] Auto-creating 7-day bot challenge using preset: ${preset.name}`,
         {
            lengths: preset.wordLengths,
            attempts: preset.maxAttempts,
            forceOrder: preset.marathonForceOrder,
            isHandicap: preset.isHandicap,
            handicapEnforced: preset.handicapEnforced,
            hintsDisabled: preset.disableHints,
         },
      );

      // 3. Build 7-day sequence (numDays = 7, lifespanHours = 168)
      const numDays = 7;
      const lifespanHours = 168;
      const baseSequence = [...preset.wordLengths];
      const resolvedMarathonGames: number[] = [];
      for (let d = 0; d < numDays; d++) {
         resolvedMarathonGames.push(...baseSequence);
      }

      const salt = Math.random().toString(36).substring(2, 15);
      const resolveDiff = (idx: number): "easy" | "normal" | "difficult" => {
         if (Array.isArray(preset.difficulty)) {
            const baseIdx = idx % baseSequence.length;
            return preset.difficulty[baseIdx] ?? "normal";
         }
         return preset.difficulty ?? "normal";
      };

      // 4. Generate obfuscated target words for all games across the 7 days (locally from words.ts)
      const targetArray: { length: number; word: string }[] = [];
      const plainMarathonTargets: Record<number, string> = {};
      const chosenWords = new Set<string>();

      for (let idx = 0; idx < resolvedMarathonGames.length; idx++) {
         const l = resolvedMarathonGames[idx];
         const diff = resolveDiff(idx);
         let word = (await getRandomWord(l, diff, true)).toUpperCase();
         let limit = 0;
         while (chosenWords.has(word) && limit < 200) {
            word = (await getRandomWord(l, diff, true)).toUpperCase();
            limit++;
         }
         chosenWords.add(word);
         plainMarathonTargets[idx] = word;
         targetArray.push({
            length: l,
            word: obfuscateWord(word, salt),
         });
      }

      const targetWord = JSON.stringify(targetArray);

      // 5. Generate handicap starters if enabled in the preset
      let finalHandicapStarter: any = null;
      let finalHandicapStarters: any = null;
      const isHandicapRandom = !!preset.isHandicap;

      if (isHandicapRandom) {
         const generated = await generateHandicapStarters({
            targetWord: "",
            length: 1,
            marathonGames: resolvedMarathonGames,
            plainMarathonTargets,
            handicapLevel: preset.handicapLevel ?? "normal",
            handicapRows: preset.handicapRows ?? 1,
         });
         finalHandicapStarter = generated.finalHandicapStarter;
         finalHandicapStarters = generated.finalHandicapStarters;
      }

      // 6. Compute expires_at (168 hours / 7 days from creation, matching createChallenge.ts)
      const expiresAt = new Date(
         now.getTime() + lifespanHours * 60 * 60 * 1000,
      );

      // 7. Insert Challenge row matching exact ChallengeCreate schema
      const { error: challengeError } = await supabase
         .from("challenges")
         .insert([
            {
               creator_id: BOT_CREATOR_ID,
               mode: "ANYTIME",
               word_length: 1, // Marathon mode
               target_word: targetWord,
               salt: salt,
               max_attempts: preset.maxAttempts,
               max_time: null,
               expires_at: expiresAt.toISOString(),
               is_public: false,
               max_participants: null,
               is_custom_word: false,
               handicap_starter: finalHandicapStarter,
               handicap_starters: finalHandicapStarters,
               handicap_enforced: !!preset.handicapEnforced,
               handicap_starter_is_random: isHandicapRandom,
               disable_hints: !!preset.disableHints,
               marathon_timers: preset.marathonTimers ?? null,
               marathon_force_order: !!preset.marathonForceOrder,
               is_bot_marathon: true,
               is_sentence: false, // Strictly no sentence games
               is_shapeshifter: false,
               notify_creator: false,
            },
         ]);

      if (challengeError) {
         logger.warn(
            "[BotMarathon] Creation note/conflict:",
            challengeError.message,
         );
         safeLocalStorage.setItem(weekKey, "created");
         safeLocalStorage.removeItem(lockKey);
         isAutoCreating = false;
         return false;
      }

      safeLocalStorage.setItem(weekKey, "created");
      safeLocalStorage.removeItem(lockKey);
      logger.info(
         "[BotMarathon] Successfully generated 7-day Daily Bot Challenge!",
      );
      return true;
   } catch (err: any) {
      logger.error("[BotMarathon] Error during auto-creation:", { error: err });
      safeLocalStorage.removeItem(lockKey);
      return false;
   } finally {
      isAutoCreating = false;
   }
}
